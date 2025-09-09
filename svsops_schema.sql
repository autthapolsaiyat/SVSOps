BEGIN;

-- =============== MASTER ===============
CREATE TABLE IF NOT EXISTS inv_items (
  id BIGSERIAL PRIMARY KEY,
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  uom TEXT NOT NULL DEFAULT 'EA',
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS inv_warehouses (
  id BIGSERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL
);

-- =============== MOVES ===============
CREATE TABLE IF NOT EXISTS inv_stock_moves (
  id BIGSERIAL PRIMARY KEY,
  item_id BIGINT NOT NULL REFERENCES inv_items(id),
  wh_id BIGINT NOT NULL REFERENCES inv_warehouses(id),
  move_type TEXT NOT NULL CHECK (move_type IN ('RECEIVE','ISSUE','TRANSFER_IN','TRANSFER_OUT','ADJUST_IN','ADJUST_OUT')),
  qty NUMERIC(18,6) NOT NULL CHECK (qty > 0),
  unit_cost NUMERIC(18,6) NOT NULL DEFAULT 0,
  ref_doc TEXT,
  ref_line TEXT,
  lot_no TEXT,
  move_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by BIGINT NOT NULL,
  note TEXT
);
CREATE INDEX IF NOT EXISTS inv_stock_moves_idx ON inv_stock_moves (item_id, wh_id, move_time);

-- =============== FIFO LAYERS ===============
CREATE TABLE IF NOT EXISTS inv_cost_layers (
  id BIGSERIAL PRIMARY KEY,
  item_id BIGINT NOT NULL REFERENCES inv_items(id),
  wh_id BIGINT NOT NULL REFERENCES inv_warehouses(id),
  layer_qty NUMERIC(18,6) NOT NULL CHECK (layer_qty >= 0),
  layer_cost NUMERIC(18,6) NOT NULL CHECK (layer_cost >= 0),
  remain_qty NUMERIC(18,6) NOT NULL CHECK (remain_qty >= 0),
  lot_no TEXT,
  receive_move_id BIGINT REFERENCES inv_stock_moves(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inv_cost_layers_idx ON inv_cost_layers (item_id, wh_id, created_at);

-- =============== MOVING AVERAGE SNAPSHOT ===============
CREATE TABLE IF NOT EXISTS inv_avg_cost (
  item_id BIGINT NOT NULL REFERENCES inv_items(id),
  wh_id BIGINT NOT NULL REFERENCES inv_warehouses(id),
  avg_cost NUMERIC(18,6) NOT NULL DEFAULT 0,
  onhand_qty NUMERIC(18,6) NOT NULL DEFAULT 0,
  PRIMARY KEY (item_id, wh_id)
);

-- =============== CONFIG ===============
CREATE TABLE IF NOT EXISTS inv_config (
  id SMALLINT PRIMARY KEY,
  costing_method TEXT NOT NULL CHECK (costing_method IN ('FIFO','MOVING_AVG'))
);
INSERT INTO inv_config (id, costing_method) VALUES (1, 'FIFO')
ON CONFLICT (id) DO NOTHING;

-- =============== BALANCE VIEW ===============
DROP VIEW IF EXISTS v_inv_balance;
CREATE VIEW v_inv_balance AS
SELECT item_id, wh_id,
       SUM(CASE WHEN move_type IN ('RECEIVE','TRANSFER_IN','ADJUST_IN') THEN qty ELSE 0 END)
     - SUM(CASE WHEN move_type IN ('ISSUE','TRANSFER_OUT','ADJUST_OUT') THEN qty ELSE 0 END) AS onhand_qty
FROM inv_stock_moves
GROUP BY item_id, wh_id;

-- =============== IMPORTER ===============
CREATE TABLE IF NOT EXISTS inv_import_jobs (
  id BIGSERIAL PRIMARY KEY,
  job_type TEXT NOT NULL CHECK (job_type IN ('OPENING_BALANCE','RECEIVE','ADJUST','MASTER_ITEM')),
  file_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING','VALIDATING','FAILED','APPLIED')) DEFAULT 'PENDING',
  error_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS inv_import_lines (
  id BIGSERIAL PRIMARY KEY,
  job_id BIGINT NOT NULL REFERENCES inv_import_jobs(id) ON DELETE CASCADE,
  row_no INT NOT NULL,
  sku TEXT NOT NULL,
  wh_code TEXT NOT NULL,
  qty NUMERIC(18,6) NOT NULL,
  unit_cost NUMERIC(18,6) NOT NULL DEFAULT 0,
  lot_no TEXT,
  ref_doc TEXT,
  valid BOOLEAN DEFAULT NULL,
  error_text TEXT
);
CREATE INDEX IF NOT EXISTS inv_import_lines_idx ON inv_import_lines (job_id, row_no);

-- =============== REPORTS (MATERIALIZED OPTIONAL) ===============
-- ถ้าต้องการความเร็วสูง ให้แปลง v_inv_balance เป็น MVIEW เองภายหลัง

-- =============== SO AUTONUMBER ===============
CREATE TABLE IF NOT EXISTS so_number_counters (
  scope TEXT NOT NULL,
  y INT NOT NULL,
  m INT NOT NULL,
  prefix TEXT NOT NULL,
  last_seq INT NOT NULL DEFAULT 0,
  PRIMARY KEY (scope, y, m, prefix)
);

CREATE OR REPLACE FUNCTION next_so_number(p_scope TEXT, p_prefix TEXT, p_y INT, p_m INT, p_width INT DEFAULT 5)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE v_seq INT; v_fmt TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(CONCAT('SO:', p_scope, ':', p_prefix, ':', p_y, ':', p_m)));
  INSERT INTO so_number_counters(scope,y,m,prefix,last_seq)
  VALUES(p_scope,p_y,p_m,p_prefix,0)
  ON CONFLICT (scope,y,m,prefix) DO NOTHING;

  UPDATE so_number_counters
     SET last_seq = last_seq + 1
   WHERE scope = p_scope AND y = p_y AND m = p_m AND prefix = p_prefix
   RETURNING last_seq INTO v_seq;

  v_fmt := p_prefix || '-' || p_scope || '-' || to_char(make_date(p_y, p_m, 1), 'YYMM') || '-' || lpad(v_seq::text, p_width, '0');
  RETURN v_fmt;
END $$;

-- =============== NOTIFICATIONS ===============
CREATE TABLE IF NOT EXISTS notif_rules (
  id BIGSERIAL PRIMARY KEY,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('LOW_STOCK','IMPORT_DONE','SIMILARITY_ALERT')),
  item_id BIGINT,
  wh_id BIGINT,
  threshold NUMERIC(18,6),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  channel TEXT NOT NULL CHECK (channel IN ('INAPP','EMAIL','WEBHOOK')) DEFAULT 'INAPP',
  webhook_url TEXT,
  created_by BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notif_queue (
  id BIGSERIAL PRIMARY KEY,
  rule_id BIGINT NOT NULL REFERENCES notif_rules(id),
  title TEXT NOT NULL,
  payload JSONB,
  status TEXT NOT NULL CHECK (status IN ('PENDING','SENT','FAILED')) DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS notif_queue_idx ON notif_queue (status, created_at);

COMMIT;
