-- SVSSYSTEM Inventory (Full Stock) Schema for PostgreSQL
BEGIN;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS warehouses (
  wh_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wh_code      TEXT UNIQUE NOT NULL,
  wh_name      TEXT NOT NULL,
  location     TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS items (
  item_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku          TEXT UNIQUE NOT NULL,
  item_name    TEXT NOT NULL,
  uom          TEXT NOT NULL,
  category     TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  min_qty      NUMERIC(18,4) NOT NULL DEFAULT 0,
  reorder_point NUMERIC(18,4) NOT NULL DEFAULT 0,
  cost_method  TEXT NOT NULL DEFAULT 'FIFO' CHECK (cost_method IN ('FIFO','AVERAGE')),
  last_cost    NUMERIC(18,6) NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS batches (
  batch_id     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id      UUID NOT NULL REFERENCES items(item_id) ON DELETE CASCADE,
  lot_no       TEXT NOT NULL,
  exp_date     DATE,
  note         TEXT,
  UNIQUE(item_id, lot_no)
);

CREATE TABLE IF NOT EXISTS stock_moves (
  move_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  move_type    TEXT NOT NULL CHECK (move_type IN ('IN','OUT','ADJ','TRANSFER')),
  ref_no       TEXT,
  ref_type     TEXT,
  item_id      UUID NOT NULL REFERENCES items(item_id),
  wh_from      UUID REFERENCES warehouses(wh_id),
  wh_to        UUID REFERENCES warehouses(wh_id),
  batch_id     UUID REFERENCES batches(batch_id),
  qty          NUMERIC(18,4) NOT NULL CHECK (qty >= 0),
  unit_cost    NUMERIC(18,6) NOT NULL DEFAULT 0,
  moved_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by   TEXT,
  request_id   UUID,
  note         TEXT
);

CREATE INDEX IF NOT EXISTS idx_moves_item ON stock_moves(item_id);
CREATE INDEX IF NOT EXISTS idx_moves_wh_from ON stock_moves(wh_from);
CREATE INDEX IF NOT EXISTS idx_moves_wh_to ON stock_moves(wh_to);
CREATE INDEX IF NOT EXISTS idx_moves_moved_at ON stock_moves(moved_at);

CREATE TABLE IF NOT EXISTS stock_levels (
  item_id      UUID NOT NULL REFERENCES items(item_id) ON DELETE CASCADE,
  wh_id        UUID NOT NULL REFERENCES warehouses(wh_id) ON DELETE CASCADE,
  on_hand      NUMERIC(18,4) NOT NULL DEFAULT 0,
  reserved     NUMERIC(18,4) NOT NULL DEFAULT 0,
  avg_cost     NUMERIC(18,6) NOT NULL DEFAULT 0,
  PRIMARY KEY (item_id, wh_id)
);

CREATE TABLE IF NOT EXISTS stock_layers (
  layer_id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id        UUID NOT NULL REFERENCES items(item_id) ON DELETE CASCADE,
  wh_id          UUID NOT NULL REFERENCES warehouses(wh_id) ON DELETE CASCADE,
  batch_id       UUID REFERENCES batches(batch_id),
  move_in_id     UUID NOT NULL REFERENCES stock_moves(move_id) ON DELETE CASCADE,
  qty_in         NUMERIC(18,4) NOT NULL CHECK (qty_in >= 0),
  qty_remaining  NUMERIC(18,4) NOT NULL CHECK (qty_remaining >= 0),
  unit_cost      NUMERIC(18,6) NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_layer UNIQUE (item_id, wh_id, move_in_id)
);

CREATE OR REPLACE FUNCTION upsert_stock_level(p_item UUID, p_wh UUID, p_onhand_delta NUMERIC, p_reserved_delta NUMERIC, p_new_avg NUMERIC, p_set_avg BOOLEAN)
RETURNS VOID AS $$
BEGIN
  INSERT INTO stock_levels(item_id, wh_id, on_hand, reserved, avg_cost)
  VALUES (p_item, p_wh, COALESCE(p_onhand_delta,0), COALESCE(p_reserved_delta,0), COALESCE(p_new_avg,0))
  ON CONFLICT (item_id, wh_id) DO UPDATE SET
    on_hand  = stock_levels.on_hand + COALESCE(EXCLUDED.on_hand,0),
    reserved = stock_levels.reserved + COALESCE(EXCLUDED.reserved,0),
    avg_cost = CASE WHEN p_set_avg THEN COALESCE(p_new_avg, stock_levels.avg_cost) ELSE stock_levels.avg_cost END;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION recalc_avg_on_in(p_item UUID, p_wh UUID, p_qty NUMERIC, p_unit_cost NUMERIC)
RETURNS NUMERIC AS $$
DECLARE
  old_on NUMERIC;
  old_avg NUMERIC;
  new_avg NUMERIC;
BEGIN
  SELECT on_hand, avg_cost INTO old_on, old_avg
  FROM stock_levels WHERE item_id=p_item AND wh_id=p_wh FOR UPDATE;
  IF NOT FOUND THEN
    RETURN p_unit_cost;
  END IF;
  IF (old_on + p_qty) = 0 THEN
    RETURN 0;
  END IF;
  new_avg := ((COALESCE(old_on,0) * COALESCE(old_avg,0)) + (p_qty * p_unit_cost)) / (old_on + p_qty);
  RETURN new_avg;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_stock_moves_after_insert()
RETURNS TRIGGER AS $$
DECLARE
  effective_wh UUID;
  new_avg NUMERIC;
BEGIN
  IF (NEW.move_type = 'IN' OR (NEW.move_type = 'ADJ' AND NEW.qty > 0)) THEN
    effective_wh := COALESCE(NEW.wh_to, NEW.wh_from);
    new_avg := recalc_avg_on_in(NEW.item_id, effective_wh, NEW.qty, NEW.unit_cost);
    PERFORM upsert_stock_level(NEW.item_id, effective_wh, NEW.qty, 0, new_avg, TRUE);
    INSERT INTO stock_layers(item_id, wh_id, batch_id, move_in_id, qty_in, qty_remaining, unit_cost)
    VALUES (NEW.item_id, effective_wh, NEW.batch_id, NEW.move_id, NEW.qty, NEW.qty, NEW.unit_cost);
    RETURN NEW;
  ELSIF (NEW.move_type = 'OUT') THEN
    effective_wh := COALESCE(NEW.wh_from, NEW.wh_to);
    PERFORM upsert_stock_level(NEW.item_id, effective_wh, -NEW.qty, 0, NULL, FALSE);
    RETURN NEW;
  ELSIF (NEW.move_type = 'TRANSFER') THEN
    PERFORM upsert_stock_level(NEW.item_id, NEW.wh_from, -NEW.qty, 0, NULL, FALSE);
    PERFORM upsert_stock_level(NEW.item_id, NEW.wh_to, NEW.qty, 0, NULL, FALSE);
    RETURN NEW;
  ELSIF (NEW.move_type = 'ADJ' AND NEW.qty < 0) THEN
    effective_wh := COALESCE(NEW.wh_from, NEW.wh_to);
    PERFORM upsert_stock_level(NEW.item_id, effective_wh, NEW.qty, 0, NULL, FALSE);
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS stock_moves_after_insert ON stock_moves;
CREATE TRIGGER stock_moves_after_insert
AFTER INSERT ON stock_moves
FOR EACH ROW EXECUTE FUNCTION trg_stock_moves_after_insert();

CREATE OR REPLACE FUNCTION fifo_consume(p_item UUID, p_wh UUID, p_qty NUMERIC, p_batch UUID DEFAULT NULL)
RETURNS TABLE(layer_id UUID, qty_taken NUMERIC, unit_cost NUMERIC) AS $$
DECLARE
  remaining NUMERIC := p_qty;
  lid UUID;
  take_qty NUMERIC;
  ucost NUMERIC;
BEGIN
  FOR lid, take_qty, ucost IN
    SELECT l.layer_id,
           LEAST(l.qty_remaining, remaining) AS take_qty,
           l.unit_cost
    FROM stock_layers l
    WHERE l.item_id=p_item AND l.wh_id=p_wh
      AND (p_batch IS NULL OR l.batch_id = p_batch)
      AND l.qty_remaining > 0
    ORDER BY l.created_at ASC, l.layer_id ASC
  LOOP
    EXIT WHEN remaining <= 0;
    UPDATE stock_layers
      SET qty_remaining = qty_remaining - take_qty
      WHERE layer_id = lid;
    remaining := remaining - take_qty;
    RETURN NEXT;
  END LOOP;
  IF remaining > 0 THEN
    RAISE EXCEPTION 'Insufficient FIFO layers for item %, wh %, need % more units', p_item, p_wh, remaining;
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMIT;
