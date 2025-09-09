
-- ============================================================
-- SVS-Ops: Sales Orders & Invoices (Domestic/Foreign)
-- Bootstrap DDL + Functions + Seeds + Minimal Reports
-- PostgreSQL 16+
-- ============================================================

-- 0) Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1) Namespaces (optional)
-- CREATE SCHEMA IF NOT EXISTS ops;
-- SET search_path TO ops, public;

-- 2) Auditing (minimal)
CREATE TABLE IF NOT EXISTS audit_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ts           timestamptz NOT NULL DEFAULT now(),
  actor_id     uuid NULL,
  action       text NOT NULL,              -- 'insert' | 'update' | 'delete' | 'issue' | 'confirm' | 'cancel' | ...
  table_name   text NOT NULL,
  row_id       uuid NULL,
  detail       jsonb NULL
);

-- helper to emit log
CREATE OR REPLACE FUNCTION write_audit(_action text, _table text, _row uuid, _detail jsonb)
RETURNS void AS $$
BEGIN
  INSERT INTO audit_log(action, table_name, row_id, detail) VALUES (_action, _table, _row, _detail);
END$$ LANGUAGE plpgsql;

-- 3) Doc counters for safe concurrent numbering
CREATE TABLE IF NOT EXISTS doc_counters (
  doc_type TEXT NOT NULL,    -- 'SO' or 'IV'
  scope1   TEXT NOT NULL,    -- SO: team_code, IV: 'domestic' | 'foreign'
  yymm     TEXT NOT NULL,    -- '6807' (พ.ศ. 2568 → 68), month 07
  next_no  INTEGER NOT NULL,
  PRIMARY KEY (doc_type, scope1, yymm)
);

-- 3.1) Thai YYMM helper (พ.ศ. → 2 digits) - if you prefer ค.ศ., switch to to_char(date,'YYMM')
CREATE OR REPLACE FUNCTION thai_yymm(d date) RETURNS text AS $$
BEGIN
  RETURN lpad(((extract(year from d)::int + 543) % 100)::text, 2, '0') ||
         to_char(d, 'MM');
END $$ LANGUAGE plpgsql IMMUTABLE;

-- 3.2) Next SO number (per team / month)  e.g. SOSTD68070001
CREATE OR REPLACE FUNCTION next_so_no(p_team_code text, p_issue_date date, p_start_at integer DEFAULT 1)
RETURNS text AS $$
DECLARE yymm text; n int; so text;
BEGIN
  yymm := thai_yymm(p_issue_date);
  INSERT INTO doc_counters (doc_type, scope1, yymm, next_no)
    VALUES ('SO', p_team_code, yymm, p_start_at)
  ON CONFLICT (doc_type, scope1, yymm)
    DO UPDATE SET next_no = doc_counters.next_no + 1
  RETURNING next_no INTO n;

  -- numbering starts at p_start_at → display n-1
  so := 'SO' || p_team_code || yymm || lpad((n - 1)::text, 4, '0');
  RETURN so;
END $$ LANGUAGE plpgsql;

-- 3.3) Next IV number (per type / month) e.g. IV68070001
CREATE OR REPLACE FUNCTION next_iv_no(p_type text, p_issue_date date, p_start_at integer DEFAULT 1)
RETURNS text AS $$
DECLARE yymm text; n int; iv text;
BEGIN
  IF p_type NOT IN ('domestic','foreign') THEN
    RAISE EXCEPTION 'invalid iv type: %', p_type;
  END IF;

  yymm := thai_yymm(p_issue_date);
  INSERT INTO doc_counters (doc_type, scope1, yymm, next_no)
    VALUES ('IV', p_type, yymm, p_start_at)
  ON CONFLICT (doc_type, scope1, yymm)
    DO UPDATE SET next_no = doc_counters.next_no + 1
  RETURNING next_no INTO n;

  iv := 'IV' || yymm || lpad((n - 1)::text, 4, '0');
  RETURN iv;
END $$ LANGUAGE plpgsql;

-- 4) Masters
CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,      -- STD, PT, FSA, ...
  name_th text NOT NULL,
  name_en text NULL,
  owner_display text NULL,
  status text NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text UNIQUE NOT NULL,
  name text NOT NULL,
  team_id uuid NOT NULL REFERENCES teams(id),
  unit text NOT NULL,
  price_ex_vat numeric(14,2) NULL,
  vat_rate numeric(5,2) NOT NULL DEFAULT 7.00,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_products_team ON products(team_id, status);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE,
  name text NOT NULL,
  tax_id text NULL,
  address text NULL,
  contact_name text NULL,
  contact_phone text NULL,
  contact_email text NULL,
  billing_address text NULL,
  shipping_address text NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5) Sale Orders
CREATE TABLE IF NOT EXISTS sale_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  so_no text UNIQUE NOT NULL,
  team_id uuid NOT NULL REFERENCES teams(id),
  customer_id uuid NOT NULL REFERENCES customers(id),
  po_no text, po_date date,
  quote_no text, quote_date date,
  issue_date date NOT NULL,
  payment_term_days int,
  due_date date,
  currency text NOT NULL DEFAULT 'THB',
  remarks text,
  status text NOT NULL DEFAULT 'draft', -- draft, confirmed, closed, canceled
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sale_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_order_id uuid NOT NULL REFERENCES sale_orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id),
  description text,
  qty numeric(14,4) NOT NULL,
  unit text NOT NULL,
  unit_price numeric(14,2) NOT NULL,
  amount_ex_vat numeric(14,2) NOT NULL,
  billed_qty numeric(14,4) NOT NULL DEFAULT 0 -- partial invoice tracking
);

CREATE INDEX IF NOT EXISTS idx_so_team_date ON sale_orders(team_id, issue_date);
CREATE INDEX IF NOT EXISTS idx_so_customer ON sale_orders(customer_id);

-- keep updated_at fresh
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_so_touch ON sale_orders;
CREATE TRIGGER trg_so_touch BEFORE UPDATE ON sale_orders
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- 6) Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  iv_no text UNIQUE NOT NULL,
  type text NOT NULL CHECK (type IN ('domestic','foreign')),
  so_id uuid NOT NULL REFERENCES sale_orders(id),
  issue_date date NOT NULL,
  due_date date,
  customer_id uuid NOT NULL REFERENCES customers(id),
  currency text NOT NULL DEFAULT 'THB',
  fx_rate numeric(12,6),
  remarks text,
  status text NOT NULL DEFAULT 'draft', -- draft, issued, paid, partially_paid, canceled
  amount_ex_vat numeric(14,2) NOT NULL DEFAULT 0,
  vat_amount numeric(14,2) NOT NULL DEFAULT 0,
  grand_total  numeric(14,2) NOT NULL DEFAULT 0,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_iv_type_date ON invoices(type, issue_date);

CREATE TABLE IF NOT EXISTS invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  so_item_id uuid NULL REFERENCES sale_order_items(id),
  description text NOT NULL,
  qty numeric(14,4) NOT NULL,
  unit text NOT NULL,
  unit_price numeric(14,2) NOT NULL,
  amount_ex_vat numeric(14,2) NOT NULL,
  vat_rate numeric(5,2) NOT NULL
);

-- helper to recalc invoice totals
CREATE OR REPLACE FUNCTION recalc_invoice_totals(p_invoice_id uuid) RETURNS void AS $$
DECLARE s numeric(14,2); v numeric(14,2);
BEGIN
  SELECT COALESCE(sum(amount_ex_vat),0) INTO s FROM invoice_items WHERE invoice_id = p_invoice_id;
  SELECT COALESCE(sum( (amount_ex_vat * vat_rate)/100.0 ),0) INTO v FROM invoice_items WHERE invoice_id = p_invoice_id;
  UPDATE invoices SET amount_ex_vat = s, vat_amount = v, grand_total = s+v WHERE id = p_invoice_id;
END $$ LANGUAGE plpgsql;

-- trigger to auto-recalc
CREATE OR REPLACE FUNCTION trg_recalc_invoice() RETURNS trigger AS $$
BEGIN
  PERFORM recalc_invoice_totals( COALESCE(NEW.invoice_id, OLD.invoice_id) );
  RETURN COALESCE(NEW, OLD);
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ivitem_recalc_aiud ON invoice_items;
CREATE TRIGGER trg_ivitem_recalc_aiud AFTER INSERT OR UPDATE OR DELETE ON invoice_items
FOR EACH ROW EXECUTE FUNCTION trg_recalc_invoice();

-- 7) Payments (optional but useful)
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  paid_date date NOT NULL,
  amount numeric(14,2) NOT NULL,
  method text NULL,       -- transfer/cash/cheque/credit-card
  ref_no text NULL,
  remarks text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- status updater for payments
CREATE OR REPLACE FUNCTION update_invoice_status_after_payment() RETURNS trigger AS $$
DECLARE paid numeric(14,2);
BEGIN
  SELECT COALESCE(sum(amount),0) INTO paid FROM payments WHERE invoice_id = NEW.invoice_id;
  UPDATE invoices
    SET status = CASE
                   WHEN paid >= grand_total THEN 'paid'
                   WHEN paid > 0 THEN 'partially_paid'
                   ELSE status
                 END
  WHERE id = NEW.invoice_id;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_payment_update_status ON payments;
CREATE TRIGGER trg_payment_update_status AFTER INSERT OR UPDATE OR DELETE ON payments
FOR EACH ROW EXECUTE FUNCTION update_invoice_status_after_payment();

-- 8) Seed Teams (ตามรูป)
-- Upsert helper CTE
WITH t(code, name_th, owner_display) AS (
  VALUES
    ('STD','สารมาตรฐาน (Reference Standard)','สุนิสา (ปู)'),
    ('PT','ตัวอย่างทดสอบ (Penetrant Testing)','สุนิสา (ปู)'),
    ('FSA','นิติวิทยาศาสตร์ (Forensic Science) - กสก, กยส, กคม, DNA, เอกสาร, ลายนิ้วมือแฝง','วิลาวรรณ (วิ)'),
    ('FSC','Forensic Science - คอม, ปืน','อรรถพล (บอย)'),
    ('SP','เตรียมตัวอย่าง (Sample Preparation)','ฐิตรัตน์ (อุ้ม)'),
    ('SERV','ช่าง (Service)','แสงง'),
    ('APP','แอปพลิเคชัน (Application Support)','สุรเดชน์ (เจตน์)'),
    ('PTL','ปิโตรเลียม (Petroleum)','วิมล'),
    ('MI','สินค้าเบ็ดเตล็ด (Miscellaneous Item)','มัลลิกา (นก)')
)
INSERT INTO teams(code, name_th, owner_display)
SELECT code, name_th, owner_display FROM t
ON CONFLICT (code) DO UPDATE SET name_th = EXCLUDED.name_th, owner_display = EXCLUDED.owner_display;

-- 9) Minimal report views
CREATE OR REPLACE VIEW rpt_sales_by_team AS
SELECT
  so.team_id,
  t.code AS team_code,
  date_trunc('month', so.issue_date)::date AS month,
  SUM(soi.amount_ex_vat) AS so_amount_ex_vat
FROM sale_orders so
JOIN sale_order_items soi ON soi.sale_order_id = so.id
JOIN teams t ON t.id = so.team_id
GROUP BY so.team_id, t.code, date_trunc('month', so.issue_date);

CREATE OR REPLACE VIEW rpt_invoices_status AS
SELECT
  iv.type, iv.status,
  date_trunc('month', iv.issue_date)::date AS month,
  COUNT(*) AS cnt,
  SUM(iv.grand_total) AS amount
FROM invoices iv
GROUP BY iv.type, iv.status, date_trunc('month', iv.issue_date);

-- 10) Convenience functions to create NOs (manual test)
-- SELECT next_so_no('STD', current_date);
-- SELECT next_iv_no('domestic', current_date);

