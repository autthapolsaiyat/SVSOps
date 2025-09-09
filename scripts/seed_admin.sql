DO $$
DECLARE hp text;
BEGIN
  SELECT crypt('pass', gen_salt('bf', 12)) INTO hp;

  IF NOT EXISTS (SELECT 1 FROM users WHERE username='admin') THEN
    INSERT INTO users (id, email, username, password_hash, status)
    VALUES (gen_random_uuid(), 'admin@example.com', 'admin', hp, 'active');
  ELSE
    UPDATE users SET password_hash = hp, status='active' WHERE username='admin';
  END IF;

  INSERT INTO user_roles (user_id, role_id)
  SELECT u.id, r.id
  FROM users u
  JOIN roles r ON r.name='admin'
  WHERE u.username='admin'
    AND NOT EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id=u.id AND ur.role_id=r.id
    );
END$$;

