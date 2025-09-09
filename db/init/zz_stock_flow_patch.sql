-- ============================================
-- SVS-Ops | SO → IV → Stock Flow Patch (Full)
-- Idempotent: safe to re-run
-- ============================================

-- EXTENSIONS (เผื่อยังไม่ได้เปิด)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------
-- 0) BRIDGE / MAP TABLES
-- ------------------------------------------------

-- 0.1 stock_moves_auto: เก็บ movement OUT อัตโนมัติจากใบ IV (ต่อบรรทัด)
CREATE TABLE IF NOT EXISTS public.stock_moves_auto (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  moved_at         timestamptz NOT NULL DEFAULT now(),
  move_type        text NOT NULL,              -- 'out'
  invoice_id       uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  invoice_item_id  uuid NOT NULL UNIQUE,       -- กันซ้ำ/กันยิงซ้ำ
  product_id       uuid NOT NULL REFERENCES products(id),
  qty              numeric(14,4) NOT NULL,
  unit             text NOT NULL,
  ref_no           text NOT NULL               -- เลข IV เช่น IV68080001
);

-- 0.2 product_item_wh_map: map products → items → warehouses
CREATE TABLE IF NOT EXISTS public.product_item_wh_map (
  product_id uuid PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  item_id    uuid NOT NULL REFERENCES items(item_id) ON DELETE RESTRICT,
  wh_id      uuid NOT NULL REFERENCES warehouses(wh_id) ON DELETE RESTRICT,
  note       text
);

-- 0.3 link table: กันซ้ำระหว่าง stock_moves_auto → stock_moves
CREATE TABLE IF NOT EXISTS public.stock_move_imports (
  sma_id   uuid PRIMARY KEY REFERENCES stock_moves_auto(id) ON DELETE CASCADE,
  move_id  uuid UNIQUE REFERENCES stock_moves(move_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------
-- 1) DOC NUMBER HELPERS (มีอยู่แล้วในระบบคุณ แต่เผื่อ)
--    *ไม่แตะ next_so_no / next_iv_no ในไฟล์นี้*
-- ------------------------------------------------

-- ------------------------------------------------
-- 2) STOCK AUTO FROM INVOICE
-- ------------------------------------------------

-- 2.1 ออก movement OUT จากใบ IV (issued) ต่อบรรทัด
CREATE OR REPLACE FUNCTION public.create_stock_out_for_invoice(p_invoice_id uuid)
RETURNS void AS $$
BEGIN
  INSERT INTO stock_moves_auto (move_type, invoice_id, invoice_item_id, product_id, qty, unit, ref_no)
  SELECT
    'out'::text,
    iv.id,
    ivit.id,
    COALESCE(soi.product_id, p.id),         -- ปกติจะมากับ SO; fallback เป็น product ในบรรทัด
    ivit.qty,
    ivit.unit,
    iv.iv_no
  FROM invoices iv
  JOIN invoice_items ivit ON ivit.invoice_id = iv.id
  LEFT JOIN sale_order_items soi ON soi.id = ivit.so_item_id
  LEFT JOIN products p ON p.id = COALESCE(soi.product_id, ivit.product_id)
  WHERE iv.id = p_invoice_id
    AND NOT EXISTS (SELECT 1 FROM stock_moves_auto sma WHERE sma.invoice_item_id = ivit.id);
END
$$ LANGUAGE plpgsql;

-- 2.2 ยกเลิก movement OUT ของใบ IV ที่ระบุ (ใช้ตอน cancel)
CREATE OR REPLACE FUNCTION public.delete_stock_out_for_invoice(p_invoice_id uuid)
RETURNS void AS $$
BEGIN
  DELETE FROM stock_moves_auto WHERE invoice_id = p_invoice_id;
END
$$ LANGUAGE plpgsql;

-- ------------------------------------------------
-- 3) SYNC stock_moves_auto → stock_moves (ตารางหลัก)
-- ------------------------------------------------

-- 3.1 sync แถวเดียว (กันซ้ำด้วย stock_move_imports)
CREATE OR REPLACE FUNCTION public.sync_one_stock_move_from_auto(p_sma_id uuid)
RETURNS void AS $$
DECLARE
  v_prod uuid; v_qty numeric(18,4); v_unit text; v_ref text;
  v_item uuid; v_wh uuid; v_move uuid;
BEGIN
  SELECT sma.product_id, sma.qty::numeric(18,4), sma.unit, sma.ref_no
    INTO v_prod, v_qty, v_unit, v_ref
  FROM stock_moves_auto sma WHERE sma.id = p_sma_id;

  IF v_prod IS NULL THEN
    RAISE EXCEPTION 'sync_one: stock_moves_auto % not found', p_sma_id;
  END IF;

  -- map product → item & wh
  SELECT m.item_id, m.wh_id INTO v_item, v_wh
  FROM product_item_wh_map m WHERE m.product_id = v_prod;

  IF v_item IS NULL OR v_wh IS NULL THEN
    RAISE EXCEPTION 'mapping missing for product %, please insert into product_item_wh_map', v_prod;
  END IF;

  -- skip ถ้ามีแล้ว
  IF EXISTS (SELECT 1 FROM stock_move_imports WHERE sma_id = p_sma_id) THEN
    RETURN;
  END IF;

  -- insert OUT เข้าตารางหลัก
  INSERT INTO stock_moves(
    move_type, ref_no, ref_type, item_id, wh_from, qty, unit_cost, moved_at, note
  )
  VALUES ('OUT', v_ref, 'IV', v_item, v_wh, v_qty, 0, now(), 'AUTO from invoices via stock_moves_auto')
  RETURNING move_id INTO v_move;

  INSERT INTO stock_move_imports(sma_id, move_id) VALUES (p_sma_id, v_move);
END
$$ LANGUAGE plpgsql;

-- 3.2 sync backlog ทั้งหมดที่ยังไม่เข้า stock_moves
DROP FUNCTION IF EXISTS public.sync_all_stock_moves_from_auto();
CREATE OR REPLACE FUNCTION public.sync_all_stock_moves_from_auto()
RETURNS integer AS $$
DECLARE r record; cnt int := 0;
BEGIN
  FOR r IN
    SELECT id
    FROM stock_moves_auto a
    WHERE NOT EXISTS (SELECT 1 FROM stock_move_imports i WHERE i.sma_id = a.id)
  LOOP
    PERFORM sync_one_stock_move_from_auto(r.id);
    cnt := cnt + 1;
  END LOOP;
  RETURN cnt;
END
$$ LANGUAGE plpgsql;

-- 3.3 triggers ที่ stock_moves_auto: insert → sync / delete → cleanup
CREATE OR REPLACE FUNCTION public.trg_on_sma_after_insert()
RETURNS trigger AS $$
BEGIN
  PERFORM sync_one_stock_move_from_auto(NEW.id);
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sma_after_insert_sync ON stock_moves_auto;
CREATE TRIGGER sma_after_insert_sync
AFTER INSERT ON stock_moves_auto
FOR EACH ROW EXECUTE FUNCTION trg_on_sma_after_insert();

CREATE OR REPLACE FUNCTION public.trg_on_sma_after_delete()
RETURNS trigger AS $$
DECLARE v_move uuid;
BEGIN
  SELECT move_id INTO v_move FROM stock_move_imports WHERE sma_id = OLD.id;
  IF v_move IS NOT NULL THEN
    DELETE FROM stock_moves WHERE move_id = v_move;
    DELETE FROM stock_move_imports WHERE sma_id = OLD.id;
  END IF;
  RETURN OLD;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sma_after_delete_cleanup ON stock_moves_auto;
CREATE TRIGGER sma_after_delete_cleanup
AFTER DELETE ON stock_moves_auto
FOR EACH ROW EXECUTE FUNCTION trg_on_sma_after_delete();

-- ------------------------------------------------
-- 4) HELPERS: mapping / utilities
-- ------------------------------------------------

-- 4.1 คืน item_id, wh_id จาก product_id (ใช้ในหลายฟังก์ชัน)
DROP FUNCTION IF EXISTS public.map_product_to_item_wh_ids(uuid);
CREATE OR REPLACE FUNCTION public.map_product_to_item_wh_ids(p_product_id uuid)
RETURNS TABLE(o_item uuid, o_wh uuid) AS $$
BEGIN
  RETURN QUERY
  SELECT m.item_id, m.wh_id
  FROM product_item_wh_map m
  WHERE m.product_id = p_product_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'mapping missing for product % in product_item_wh_map', p_product_id;
  END IF;
END
$$ LANGUAGE plpgsql;

-- 4.2 helper สำหรับสร้าง/อัปเดต mapping ด้วย SKU + WH code
CREATE OR REPLACE FUNCTION public.map_product_to_item_wh(p_sku text, p_wh_code text, p_cost_method text DEFAULT 'FIFO')
RETURNS void AS $$
DECLARE v_prod uuid; v_item uuid; v_wh uuid; v_name text; v_uom text;
BEGIN
  SELECT id, name, COALESCE(unit,'EA') INTO v_prod, v_name, v_uom
  FROM products WHERE sku=p_sku;
  IF v_prod IS NULL THEN RAISE EXCEPTION 'product sku % not found', p_sku; END IF;

  SELECT wh_id INTO v_wh FROM warehouses WHERE wh_code=p_wh_code;
  IF v_wh IS NULL THEN RAISE EXCEPTION 'warehouse % not found', p_wh_code; END IF;

  SELECT item_id INTO v_item FROM items WHERE sku=p_sku;
  IF v_item IS NULL THEN
    IF p_cost_method NOT IN ('FIFO','AVERAGE') THEN
      RAISE EXCEPTION 'cost_method must be FIFO or AVERAGE';
    END IF;
    INSERT INTO items(item_id, sku, item_name, uom, category, is_active,
                      min_qty, reorder_point, cost_method, last_cost, created_at)
    VALUES (gen_random_uuid(), p_sku, v_name, v_uom, 'FG', true, 0, 0, p_cost_method, 0, now())
    RETURNING item_id INTO v_item;
  END IF;

  INSERT INTO product_item_wh_map(product_id, item_id, wh_id, note)
  VALUES (v_prod, v_item, v_wh, 'auto map')
  ON CONFLICT (product_id) DO UPDATE SET item_id=EXCLUDED.item_id, wh_id=EXCLUDED.wh_id;
END
$$ LANGUAGE plpgsql;

-- ------------------------------------------------
-- 5) RESERVED FLOW (SO confirm / IV issued / SO close)
-- ------------------------------------------------

-- 5.1 กันสต็อกจาก SO (sign=+1 กัน, -1 คืนทั้งหมดของใบ)
CREATE OR REPLACE FUNCTION public.adjust_reserved_for_so(p_so_id uuid, p_sign int)
RETURNS void AS $$
DECLARE r record; v_item uuid; v_wh uuid;
BEGIN
  IF p_sign NOT IN (1,-1) THEN RAISE EXCEPTION 'p_sign must be 1 or -1'; END IF;

  FOR r IN
    SELECT soi.product_id, soi.qty
    FROM sale_order_items soi
    WHERE soi.sale_order_id = p_so_id
  LOOP
    SELECT o_item, o_wh INTO v_item, v_wh FROM map_product_to_item_wh_ids(r.product_id);

    INSERT INTO stock_levels(item_id, wh_id, on_hand, reserved, avg_cost)
    VALUES (v_item, v_wh, 0, GREATEST(0, p_sign * r.qty), 0)
    ON CONFLICT (item_id, wh_id)
    DO UPDATE SET reserved = GREATEST(0, stock_levels.reserved + p_sign * r.qty);
  END LOOP;
END
$$ LANGUAGE plpgsql;

-- 5.2 ลด reserved ตามรายการที่ออกใบ IV
CREATE OR REPLACE FUNCTION public.reduce_reserved_on_invoice(p_invoice_id uuid)
RETURNS void AS $$
DECLARE r record; v_item uuid; v_wh uuid;
BEGIN
  FOR r IN
    SELECT soi.product_id, ivit.qty
    FROM invoice_items ivit
    JOIN sale_order_items soi ON soi.id = ivit.so_item_id
    WHERE ivit.invoice_id = p_invoice_id
  LOOP
    SELECT o_item, o_wh INTO v_item, v_wh FROM map_product_to_item_wh_ids(r.product_id);
    UPDATE stock_levels
      SET reserved = GREATEST(0, reserved - r.qty)
      WHERE item_id = v_item AND wh_id = v_wh;
  END LOOP;
END
$$ LANGUAGE plpgsql;

-- 5.3 คืน reserved เฉพาะส่วนคงค้าง (qty - billed_qty) ต่อใบ SO
CREATE OR REPLACE FUNCTION public.release_remaining_reserved_for_so(p_so_id uuid)
RETURNS void AS $$
DECLARE r record; v_item uuid; v_wh uuid; v_remain numeric(18,4);
BEGIN
  FOR r IN
    SELECT soi.product_id, GREATEST(0, soi.qty - soi.billed_qty) AS remain_qty
    FROM sale_order_items soi
    WHERE soi.sale_order_id = p_so_id
  LOOP
    v_remain := r.remain_qty;
    IF v_remain > 0 THEN
      SELECT o_item, o_wh INTO v_item, v_wh FROM map_product_to_item_wh_ids(r.product_id);
      UPDATE stock_levels
        SET reserved = GREATEST(0, reserved - v_remain)
        WHERE item_id = v_item AND wh_id = v_wh;
    END IF;
  END LOOP;
END
$$ LANGUAGE plpgsql;

-- 5.4 คำนวณ reserved ใหม่เฉพาะสินค้าของ SO ใบที่ปิด/ยกเลิก (กันค้าง)
CREATE OR REPLACE FUNCTION public.recompute_reserved_for_so(p_so_id uuid)
RETURNS void AS $$
DECLARE r record; v_item uuid; v_wh uuid;
BEGIN
  FOR r IN
    SELECT DISTINCT soi.product_id
    FROM sale_order_items soi
    WHERE soi.sale_order_id = p_so_id
  LOOP
    SELECT o_item, o_wh INTO v_item, v_wh FROM map_product_to_item_wh_ids(r.product_id);

    WITH need AS (
      SELECT SUM(GREATEST(0, soi.qty - soi.billed_qty))::numeric(18,4) AS qty
      FROM sale_order_items soi
      JOIN sale_orders so ON so.id = soi.sale_order_id
      WHERE so.status = 'confirmed' AND soi.product_id = r.product_id
    )
    UPDATE stock_levels sl
       SET reserved = COALESCE((SELECT qty FROM need), 0)
     WHERE sl.item_id = v_item AND sl.wh_id = v_wh;
  END LOOP;
END
$$ LANGUAGE plpgsql;

-- 5.5 คำนวณ reserved ใหม่ทั้งระบบ (reconcile)
CREATE OR REPLACE FUNCTION public.recompute_reserved_all()
RETURNS void AS $$
DECLARE r record; v_item uuid; v_wh uuid;
BEGIN
  UPDATE stock_levels SET reserved = 0;
  FOR r IN
    SELECT soi.product_id,
           SUM(GREATEST(0, soi.qty - soi.billed_qty))::numeric(18,4) AS need_reserved
    FROM sale_order_items soi
    JOIN sale_orders so ON so.id = soi.sale_order_id
    WHERE so.status = 'confirmed'
    GROUP BY soi.product_id
  LOOP
    SELECT o_item, o_wh INTO v_item, v_wh FROM map_product_to_item_wh_ids(r.product_id);
    INSERT INTO stock_levels(item_id, wh_id, on_hand, reserved, avg_cost)
    VALUES (v_item, v_wh, 0, r.need_reserved, 0)
    ON CONFLICT (item_id, wh_id)
    DO UPDATE SET reserved = r.need_reserved;
  END LOOP;
END
$$ LANGUAGE plpgsql;

-- ------------------------------------------------
-- 6) TRIGGERS: SO / IV / IV items / stock_moves_auto
-- ------------------------------------------------

-- 6.1 SO: confirm → reserve+, closed/canceled → คืนส่วนคงค้าง + reconcile เฉพาะใบ
CREATE OR REPLACE FUNCTION public.trg_on_so_status_change()
RETURNS trigger AS $$
BEGIN
  IF OLD.status <> 'confirmed' AND NEW.status = 'confirmed' THEN
    PERFORM adjust_reserved_for_so(NEW.id, 1);
  END IF;

  IF NEW.status IN ('canceled','closed') AND OLD.status <> NEW.status THEN
    PERFORM release_remaining_reserved_for_so(NEW.id);
    PERFORM recompute_reserved_for_so(NEW.id);
  END IF;

  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_so_status ON sale_orders;
CREATE TRIGGER trg_so_status
AFTER UPDATE OF status ON sale_orders
FOR EACH ROW EXECUTE FUNCTION trg_on_so_status_change();

-- 6.2 IV: เมื่อ issued → ลด reserved
CREATE OR REPLACE FUNCTION public.trg_on_invoice_issued_reduce_reserved()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'issued' THEN
    PERFORM reduce_reserved_on_invoice(NEW.id);
  END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_iv_reduce_reserved ON invoices;
CREATE TRIGGER trg_iv_reduce_reserved
AFTER INSERT OR UPDATE OF status ON invoices
FOR EACH ROW EXECUTE FUNCTION trg_on_invoice_issued_reduce_reserved();

-- 6.3 IV items: เมื่อเพิ่ม/แก้/ลบรายการในใบที่เป็น issued → ลด reserved + สร้าง OUT
CREATE OR REPLACE FUNCTION public.trg_on_invoice_item_after_change()
RETURNS trigger AS $$
DECLARE v_iv_id uuid; v_status text;
BEGIN
  v_iv_id := COALESCE(NEW.invoice_id, OLD.invoice_id);
  SELECT status INTO v_status FROM invoices WHERE id = v_iv_id;

  IF v_status = 'issued' THEN
    PERFORM reduce_reserved_on_invoice(v_iv_id);
    PERFORM create_stock_out_for_invoice(v_iv_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ivitem_after_change ON invoice_items;
CREATE TRIGGER trg_ivitem_after_change
AFTER INSERT OR UPDATE OR DELETE ON invoice_items
FOR EACH ROW EXECUTE FUNCTION trg_on_invoice_item_after_change();

-- ============================================
-- END OF PATCH
-- ============================================

