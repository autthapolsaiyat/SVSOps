-- === Teams table ===
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- === Product Groups table ===
CREATE TABLE IF NOT EXISTS product_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_domestic BOOLEAN NOT NULL DEFAULT FALSE
);

-- === Products table (ถ้ามีอยู่แล้วให้ ALTER) ===
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- === Mapping: products ↔ groups ===
CREATE TABLE IF NOT EXISTS product_group_map (
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES product_groups(id) ON DELETE CASCADE,
  tag TEXT,
  PRIMARY KEY (product_id, group_id)
);

-- === Mapping: products ↔ teams (รองรับหลายทีม/ownership) ===
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'team_ownership') THEN
    CREATE TYPE team_ownership AS ENUM ('primary', 'secondary');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS product_team_map (
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  ownership team_ownership NOT NULL DEFAULT 'primary',
  PRIMARY KEY (product_id, team_id)
);

-- === Indexes ===
CREATE INDEX IF NOT EXISTS idx_products_name_trgm
  ON products USING GIN (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_product_groups_name_trgm
  ON product_groups USING GIN (name gin_trgm_ops);

