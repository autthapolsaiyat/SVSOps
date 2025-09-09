-- FILE: db/init/30-docs_schema.sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ===== Quotation =====
CREATE TABLE IF NOT EXISTS quotations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number      text UNIQUE NOT NULL,
  customer    text NOT NULL,
  status      text NOT NULL DEFAULT 'draft', -- draft|sent|accepted|rejected|expired
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz
);

CREATE TABLE IF NOT EXISTS quotation_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id  uuid NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  product_id    uuid NOT NULL REFERENCES products(id),
  sku           text NOT NULL,
  name          text NOT NULL,
  qty           numeric(12,2) NOT NULL,
  price_ex_vat  numeric(12,2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation ON quotation_items(quotation_id);

-- ===== Purchase Order =====
CREATE TABLE IF NOT EXISTS purchase_orders (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number      text UNIQUE NOT NULL,
  vendor      text NOT NULL,
  status      text NOT NULL DEFAULT 'draft', -- draft|ordered|received|cancelled
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id        uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id   uuid NOT NULL REFERENCES products(id),
  sku          text NOT NULL,
  name         text NOT NULL,
  qty          numeric(12,2) NOT NULL,
  price_ex_vat numeric(12,2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_po_items_po ON purchase_order_items(po_id);

-- ===== Sales Order =====
CREATE TABLE IF NOT EXISTS sales_orders (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number      text UNIQUE NOT NULL,
  customer    text NOT NULL,
  status      text NOT NULL DEFAULT 'draft', -- draft|confirmed|fulfilled|cancelled
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sales_order_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  so_id        uuid NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  product_id   uuid NOT NULL REFERENCES products(id),
  sku          text NOT NULL,
  name         text NOT NULL,
  qty          numeric(12,2) NOT NULL,
  price_ex_vat numeric(12,2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_so_items_so ON sales_order_items(so_id);

