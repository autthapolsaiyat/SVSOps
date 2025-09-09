-- FILE: db/init/24-products_created_at.sql
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

UPDATE products SET created_at = now() WHERE created_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_products_created_at ON products (created_at);

