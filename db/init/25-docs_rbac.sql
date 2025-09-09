-- FILE: db/init/25-docs_rbac.sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ===== เพิ่มสิทธิ์เอกสาร (idempotent) =====
INSERT INTO permissions (id,code,name,created_at)
SELECT gen_random_uuid(), c, c, now()
FROM (VALUES
  ('quote:read'),('quote:create'),('quote:update'),
  ('po:read'),('po:create'),('po:update'),('po:receive'),
  ('so:read'),('so:create'),('so:update'),('so:fulfill')
) AS t(c)
ON CONFLICT (code) DO NOTHING;

-- ชุดสิทธิ์ทั้งหมดของเอกสาร (ใช้งานซ้ำ)
-- จะใช้ใน JOIN ด้านล่าง
-- หมายเหตุ: บังคับ filter เฉพาะสิทธิ์กลุ่มเอกสาร ไม่ไปยุ่ง perms อื่น
WITH doc_perms AS (
  SELECT id, code FROM permissions
  WHERE code IN (
    'quote:read','quote:create','quote:update',
    'po:read','po:create','po:update','po:receive',
    'so:read','so:create','so:update','so:fulfill'
  )
)
-- ===== sysop/superadmin: ได้ทุกสิทธิ์เอกสาร =====
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN doc_perms p ON TRUE
WHERE r.name IN ('sysop','superadmin')
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- ===== whmgr: purchase+sales เต็ม =====
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'po:read','po:create','po:update','po:receive',
  'so:read','so:create','so:update','so:fulfill'
)
WHERE r.name = 'whmgr'
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- ===== whop: sales ครบ + อ่าน PO =====
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'so:read','so:create','so:update','so:fulfill','po:read'
)
WHERE r.name = 'whop'
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- ===== sales: quotation + sales (เบื้องต้น) =====
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'quote:read','quote:create','quote:update',
  'so:read','so:create'
)
WHERE r.name = 'sales'
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- ===== importer/reporter/approver: read-only เอกสาร =====
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('quote:read','po:read','so:read')
WHERE r.name IN ('importer','reporter','approver')
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

