// ————————————————————————————————————————————————
// FILE: sql/seed_admin_super.sql (ทำให้ admin/admin ใช้ได้ทุกเมนู ระดับ Dev)
//--------------------------------------------------
-- รันด้วย: docker compose exec db psql -U svs -d svssystem -f /docker-entrypoint-initdb.d/seed_admin_super.sql
-- หรือคัดลอกบล็อกนี้ไปวางใน psql โดยตรง


-- 1) เปิด pgcrypto (ถ้ามีอยู่แล้วจะข้าม)
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- 2) รีเซ็ตรหัสผ่านผู้ใช้ 'admin' เป็น 'admin'
UPDATE users SET password_hash = crypt('admin', gen_salt('bf')) WHERE username = 'admin';


-- 3) ทำให้เป็น superadmin (รองรับทั้งแบบมีคอลัมน์ is_superadmin และแบบ RBAC)
DO $$
BEGIN
-- ถ้ามีคอลัมน์ is_superadmin ให้ตั้งค่าเป็น TRUE
IF EXISTS (
SELECT 1 FROM information_schema.columns
WHERE table_name='users' AND column_name='is_superadmin'
) THEN
UPDATE users SET is_superadmin = TRUE WHERE username='admin';
END IF;


-- ถ้ามีตาราง roles / user_roles ให้ผูก role 'superadmin' ให้ admin
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='roles') THEN
INSERT INTO roles(name) VALUES('superadmin') ON CONFLICT DO NOTHING;
END IF;
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='user_roles') THEN
INSERT INTO user_roles(user_id, role_name)
SELECT u.id, 'superadmin' FROM users u WHERE u.username='admin'
ON CONFLICT DO NOTHING;
END IF;


-- ถ้ามีตาราง perms / role_perms ให้ผูก wildcard ทุก perm ให้กับ superadmin (ถ้า backend ใช้แนวนี้)
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='perms') THEN
-- ตัวอย่างชุดสิทธิ์หลัก
INSERT INTO perms(name) VALUES
('sales:quote'),('purchase:order'),('inventory:receive'),('sales:order'),('billing:invoice'),('session:manage'),('admin:users')
ON CONFLICT DO NOTHING;
END IF;
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='role_perms') THEN
INSERT INTO role_perms(role_name, perm_name)
SELECT 'superadmin', p.name FROM perms p
ON CONFLICT DO NOTHING;
END IF;
END $$;


-- 4) เคลียร์เซสชันเดิมให้ล็อกอินใหม่สะอาด ๆ (ถ้ามีตาราง sessions)
DO $$
BEGIN
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='sessions') THEN
TRUNCATE TABLE sessions;
END IF;
END $$;


-- เสร็จสิ้น: ล็อกอิน admin/admin แล้วควรเห็นทุกเมนูและผ่านการตรวจสิทธิ์
