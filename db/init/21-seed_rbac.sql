-- Seed roles, permissions, and initial admin
-- permissions
INSERT INTO permissions(code, name) VALUES
('user:view','ดูผู้ใช้'),('user:create','สร้างผู้ใช้'),('user:update','แก้ไขผู้ใช้'),('user:delete','ลบผู้ใช้'),
('role:view','ดูบทบาท'),('role:create','สร้างบทบาท'),('role:update','แก้ไขบทบาท'),('role:delete','ลบบทบาท'),
('perm:view','ดูสิทธิ์'),('audit:view','ดูบันทึกกิจกรรม'),
('stock:receive','รับสินค้า'),('stock:issue','เบิก/ตัดสต็อก'),('stock:transfer','โอนย้ายคลัง'),('stock:adjust','ปรับปรุงคงเหลือ'),
('so:create','สร้าง SO'),('so:update','แก้ไข SO'),('so:approve','อนุมัติ SO'),
('report:view','ดูรายงาน'),('report:export','ส่งออกรายงาน'),('import:data','นำเข้าข้อมูล')
ON CONFLICT (code) DO NOTHING;

-- roles
INSERT INTO roles(name, description) VALUES
('Admin','ผู้ดูแลระบบทั้งหมด'),
('StockOfficer','เจ้าหน้าที่คลัง'),
('SalesOfficer','เจ้าหน้าที่ขาย')
ON CONFLICT (name) DO NOTHING;

-- Admin = all permissions
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name='Admin'
ON CONFLICT DO NOTHING;

-- StockOfficer
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN ('stock:receive','stock:issue','stock:transfer','stock:adjust','report:view')
WHERE r.name='StockOfficer'
ON CONFLICT DO NOTHING;

-- SalesOfficer
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN ('so:create','so:update','report:view')
WHERE r.name='SalesOfficer'
ON CONFLICT DO NOTHING;

-- initial admin (password: Admin@12345) - change after first login
DO $$
DECLARE admin_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE username='admin') THEN
    INSERT INTO users(email, username, password_hash, status)
    VALUES ('admin@svs-ops.local', 'admin', crypt('Admin@12345', gen_salt('bf', 12)), 'active')
    RETURNING id INTO admin_id;

    INSERT INTO user_roles(user_id, role_id)
    SELECT admin_id, id FROM roles WHERE name='Admin';
  END IF;
END$$;

