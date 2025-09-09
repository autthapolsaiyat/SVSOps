const express = require('express');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const router = express.Router();

// --- ENV/Config ---
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://svs:svs@db:5432/svssystem';
const JWT_SECRET    = process.env.JWT_SECRET || 'dev-change-this';
const ACCESS_TTL_MIN = parseInt(process.env.ACCESS_TTL_MIN || '120', 10); // 120 นาที

// --- PG pool ---
const pool = new Pool({ connectionString: DATABASE_URL });

// (ชั่วคราว) ให้สิทธิ์กว้างไว้เทสต์ UI; ภายหลังค่อยดึงจากตาราง RBAC จริง
const defaultPerms = ['so:view', 'so:create', 'dash:view', 'user:view', 'stock:receive'];

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'username & password required' });

    // ตรวจรหัสผ่านด้วย pgcrypto (bcrypt/crypt)
    const sql = `
      SELECT id, username, status
      FROM users
      WHERE lower(username) = lower($1)
        AND password_hash = crypt($2, password_hash)
        AND status = 'active'
      LIMIT 1
    `;
    const { rows } = await pool.query(sql, [username, password]);
    if (!rows.length) return res.status(401).json({ error: 'invalid credentials' });

    const user = rows[0];

    // TODO: ถ้ามีตาราง RBAC ให้ดึง perms จริง; ตอนนี้ใช้ defaultPerms ไปก่อน
    const perms = defaultPerms;

    const expiresInSec = ACCESS_TTL_MIN * 60;
    const accessToken = jwt.sign(
      { sub: user.id, username: user.username, perms },
      JWT_SECRET,
      { expiresIn: expiresInSec }
    );

    res.json({
      access_token: accessToken,
      token_type: 'bearer',
      expires_in: expiresInSec,
      user: { id: user.id, username: user.username, status: user.status, perms }
    });
  } catch (e) {
    console.error('login error', e);
    res.status(500).json({ error: 'login error' });
  }
});

// GET /api/auth/me  (ต้องส่ง Authorization: Bearer <token>)
router.get('/me', (req, res) => {
  try {
    const auth = req.headers.authorization || '';
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (!m) return res.status(401).json({ error: 'missing token' });

    const payload = jwt.verify(m[1], JWT_SECRET);
    res.json({ ok: true, user: { id: payload.sub, username: payload.username }, perms: payload.perms || [] });
  } catch (e) {
    return res.status(401).json({ error: 'invalid token' });
  }
});

module.exports = router;

