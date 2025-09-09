#!/usr/bin/env bash
set -euo pipefail

# ===== Config (เปลี่ยนได้ตามต้องการ) =====
DC="${DC:-docker compose}"   # ถ้าใช้ docker-compose เดิม: export DC="docker-compose"
SVC="${SVC:-db}"             # service ชื่อ db ใน docker-compose.yml
DBU="${DBU:-svs}"            # DB user
DBN="${DBN:-svssystem}"      # DB name

say() { echo -e "\033[1;34m$*\033[0m"; }
ok()  { echo -e "✅ $*"; }
die(){ echo -e "\n\033[1;31m✗ $*\033[0m"; exit 1; }

psql_exec() {
  # ใช้ STDIN (heredoc) ส่งเข้า psql ใน container
  $DC exec -T "$SVC" psql -v ON_ERROR_STOP=1 -U "$DBU" -d "$DBN" "$@"
}

say "# 1) Ensure columns: updated_at on customers/vendors"
psql_exec <<'SQL'
ALTER TABLE customers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE vendors   ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
SQL
ok "ensured updated_at columns"

say "# 2) Create/Replace function + triggers"
psql_exec <<'SQL'
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_customers_updated_at ON customers;
CREATE TRIGGER trg_customers_updated_at
BEFORE UPDATE ON customers
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_vendors_updated_at ON vendors;
CREATE TRIGGER trg_vendors_updated_at
BEFORE UPDATE ON vendors
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
SQL
ok "created function and (re)created triggers"

say "# 3) Recreate views with updated_at"
psql_exec <<'SQL'
DROP VIEW IF EXISTS customers_std;
CREATE OR REPLACE VIEW customers_std AS
SELECT
  id,
  code,
  name,
  contact_name,
  COALESCE(contact_phone,'')            AS phone,
  COALESCE(contact_email,'')            AS email,
  COALESCE(shipping_address,address,'') AS address,
  tax_id,
  note,
  status,
  created_at,
  updated_at
FROM customers;

DROP VIEW IF EXISTS vendors_std;
CREATE OR REPLACE VIEW vendors_std AS
SELECT
  id,
  code,
  name,
  contact_name,
  phone,
  email,
  address,
  tax_id,
  note,
  created_at,
  updated_at
FROM vendors;
SQL
ok "recreated customers_std & vendors_std"

say "# 4) (optional) Indexes for updated_at ordering"
psql_exec <<'SQL'
CREATE INDEX IF NOT EXISTS idx_customers_updated_at ON customers (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_vendors_updated_at   ON vendors   (updated_at DESC);
SQL
ok "ensured updated_at indexes"

say "# 5) Verify function & triggers"
psql_exec -c "SELECT proname FROM pg_proc WHERE proname='set_updated_at';" \
  || die "function not found"
psql_exec -c "
SELECT t.tgname, c.relname
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
WHERE t.tgname IN ('trg_customers_updated_at','trg_vendors_updated_at');" \
  || die "triggers not found"

say "# 6) Show latest rows by updated_at (top 10)"
psql_exec -c "SELECT code, note, updated_at FROM customers_std ORDER BY updated_at DESC NULLS LAST LIMIT 10;"
psql_exec -c "SELECT code, note, updated_at FROM vendors_std   ORDER BY updated_at DESC NULLS LAST LIMIT 10;"

ok "All done."

