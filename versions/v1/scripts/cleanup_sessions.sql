-- ลบ session ที่ปิดแล้ว หรือ revoked แล้ว เกิน 30 วัน
DELETE FROM sessions
WHERE (revoked = TRUE OR ended_at IS NOT NULL)
  AND created_at < now() - interval '30 days';

