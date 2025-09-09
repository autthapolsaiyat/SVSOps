// server.js — SVS-Ops Backend API (Express + pg + JWT) — FULL VERSION
// -------------------------------------------------------------------
// - Adds /api/auth/login, /api/auth/me (JWT-based auth)
// - Keeps existing endpoints (teams, products, stock, reports, dashboard)
// - Adds FE-friendly aliases for sales orders:
//     POST   /api/sales-orders               (create SO; maps price_ex_vat -> unit_price)
//     POST   /api/sales-orders/:id/confirm   (confirm SO)
//     GET    /api/sales-orders               (list SOs incl. created_at)
//     POST   /api/sales-orders/:id/issue-iv  (issue invoice from SO)
// - Preserves original /api/sale-orders endpoints for compatibility

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { Pool } = require("pg");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");

dotenv.config();

// ---- normalize DATABASE_URL (convert sqlalchemy-style to pg) ----
function normalizePgUrl(u) {
  if (!u) return u;
  return u
    .replace("postgresql+asyncpg://", "postgresql://")
    .replace("postgres+asyncpg://", "postgres://");
}

const PORT = Number(process.env.PORT || 8080);
const DB_URL =
  normalizePgUrl(process.env.DATABASE_URL_DOCKER) ||
  normalizePgUrl(process.env.DATABASE_URL) ||
  "postgresql://svs:svs@localhost:5432/svssystem";

const JWT_SECRET = process.env.JWT_SECRET || "dev-change-this";
const ACCESS_TTL_MIN = parseInt(process.env.ACCESS_TTL_MIN || "120", 10); // 2h default

const pool = new Pool({ connectionString: DB_URL });

// ---- app ----
const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));

const q = (text, params) => pool.query(text, params);
const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// ---- health ----
app.get("/api/health", async (_req, res) => {
  try {
    const r = await q("SELECT 1 AS ok");
    res.json({ ok: r.rows[0].ok === 1 });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// ---- AUTH ----
// POST /api/auth/login  { username, password } -> { access_token, user, perms }
app.post("/api/auth/login", wrap(async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password)
    return res.status(400).json({ error: "username & password required" });

  const r = await q(
    `SELECT id, username, status
     FROM users
     WHERE lower(username) = lower($1)
       AND password_hash = crypt($2, password_hash)
       AND status = 'active'
     LIMIT 1`,
    [username, password]
  );
  if (r.rowCount === 0)
    return res.status(401).json({ error: "invalid credentials" });

  // TODO: replace with real RBAC lookup; grant broad perms for now
  const defaultPerms = ["so:view", "so:create", "dash:view", "user:view", "stock:receive"];
  const user = r.rows[0];
  const expiresInSec = ACCESS_TTL_MIN * 60;

  const accessToken = jwt.sign(
    { sub: user.id, username: user.username, perms: defaultPerms },
    JWT_SECRET,
    { expiresIn: expiresInSec }
  );

  res.json({
    access_token: accessToken,
    token_type: "bearer",
    expires_in: expiresInSec,
    user: { id: user.id, username: user.username, status: user.status, perms: defaultPerms },
  });
}));

// GET /api/auth/me — verify token and return current user/perms
app.get("/api/auth/me", wrap(async (req, res) => {
  const auth = req.headers.authorization || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return res.status(401).json({ error: "missing token" });
  try {
    const payload = jwt.verify(m[1], JWT_SECRET);
    res.json({ ok: true, user: { id: payload.sub, username: payload.username }, perms: payload.perms || [] });
  } catch {
    res.status(401).json({ error: "invalid token" });
  }
}));

// ---- TEAMS ----
app.get("/api/teams", wrap(async (_req, res) => {
  const r = await q(`SELECT id, code, name FROM teams ORDER BY code ASC`);
  res.json(r.rows);
}));

// ---- CUSTOMERS ----
// (accepts optional team_id, q; currently not filtering by team unless your schema has it)
app.get("/api/customers", wrap(async (req, res) => {
  const qtext = String(req.query.q || "").trim();
  // If your customers table has team_id, you can uncomment and bind it
  // const team_id = req.query.team_id || null;
  const r = await q(
    `SELECT id, code, name
     FROM customers
     WHERE ($1 = '' OR code ILIKE '%'||$1||'%' OR name ILIKE '%'||$1||'%')
     ORDER BY code ASC`,
    [qtext]
  );
  res.json(r.rows);
}));

// ---- PRODUCTS ----
app.get("/api/products", wrap(async (req, res) => {
  const team_id = req.query.team_id;
  const keyword = String(req.query.q || "");
  const page = Math.max(1, Number(req.query.page || 1));
  const page_size = Math.max(1, Number(req.query.page_size || 10));
  if (!team_id) return res.status(400).json({ error: "team_id is required" });

  const offset = (page - 1) * page_size;
  const r = await q(
    `SELECT id, sku, name, unit, team_id, price_ex_vat
     FROM products
     WHERE team_id = $1
       AND ($2 = '' OR sku ILIKE '%'||$2||'%' OR name ILIKE '%'||$2||'%')
     ORDER BY sku ASC
     LIMIT $3 OFFSET $4`,
    [team_id, keyword, page_size, offset]
  );
  res.json(r.rows);
}));

app.post("/api/products", wrap(async (req, res) => {
  const { sku, name, unit = "EA", price_ex_vat = 0, team_id } = req.body || {};
  if (!sku || !name || !team_id)
    return res.status(400).json({ error: "sku, name, team_id required" });

  const r = await q(
    `INSERT INTO products(id, sku, name, unit, price_ex_vat, team_id)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
     ON CONFLICT (sku) DO UPDATE
       SET name = EXCLUDED.name,
           unit = EXCLUDED.unit,
           price_ex_vat = EXCLUDED.price_ex_vat,
           team_id = EXCLUDED.team_id
     RETURNING id, sku, name, unit, price_ex_vat, team_id`,
    [sku, name, unit, Number(price_ex_vat || 0), team_id]
  );
  res.json(r.rows[0]);
}));

// ---- SALE ORDERS (original endpoints) ----
app.post("/api/sale-orders", wrap(async (req, res) => {
  const client = await pool.connect();
  try {
    const { team_id, customer_id, currency = "THB", items = [] } = req.body || {};
    if (!team_id || !customer_id || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "team_id, customer_id, items[] required" });
    }
    await client.query("BEGIN");

    const team = await client.query(`SELECT code FROM teams WHERE id=$1`, [team_id]);
    if (team.rowCount === 0) throw new Error("team not found");
    const team_code = team.rows[0].code;

    const head = await client.query(
      `INSERT INTO sale_orders(id, so_no, team_id, customer_id, issue_date, currency, status, remarks)
       VALUES (gen_random_uuid(), next_so_no($1, CURRENT_DATE), $2, $3, CURRENT_DATE, $4, 'draft', 'created from API')
       RETURNING id, so_no, team_id, customer_id, issue_date, currency, status, created_at`,
      [team_code, team_id, customer_id, currency]
    );
    const so_id = head.rows[0].id;

    for (const it of items) {
      const { product_id, description, qty, unit, unit_price } = it;
      const amount_ex_vat = Number(qty || 0) * Number(unit_price || 0);
      await client.query(
        `INSERT INTO sale_order_items(id, sale_order_id, product_id, description, qty, unit, unit_price, amount_ex_vat)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7)`,
        [so_id, product_id, description || "", Number(qty || 0), unit || "EA", Number(unit_price || 0), amount_ex_vat]
      );
    }

    await client.query("COMMIT");
    res.json(head.rows[0]);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}));

app.post("/api/sale-orders/:id/confirm", wrap(async (req, res) => {
  const { id } = req.params;
  const r = await q(
    `UPDATE sale_orders SET status='confirmed'
     WHERE id=$1 AND status='draft'
     RETURNING id, so_no, team_id, customer_id, issue_date, currency, status, created_at`,
    [id]
  );
  if (r.rowCount === 0) return res.status(400).json({ error: "cannot confirm (not found or not in draft)" });
  res.json(r.rows[0]);
}));

app.get("/api/sale-orders", wrap(async (req, res) => {
  const status = req.query.status;
  const sql = status
    ? `SELECT id, so_no, status, created_at FROM sale_orders WHERE status=$1 ORDER BY created_at DESC`
    : `SELECT id, so_no, status, created_at FROM sale_orders ORDER BY created_at DESC`;
  const r = await q(sql, status ? [status] : undefined);
  res.json(r.rows);
}));

// ---- INVOICES ----
app.post("/api/invoices", wrap(async (req, res) => {
  const client = await pool.connect();
  try {
    const { so_id, type = "domestic", status = "issued" } = req.body || {};
    if (!so_id) return res.status(400).json({ error: "so_id required" });
    if (!["domestic", "foreign"].includes(type)) return res.status(400).json({ error: "type must be domestic|foreign" });

    await client.query("BEGIN");

    const so = await client.query(`SELECT id, customer_id FROM sale_orders WHERE id=$1`, [so_id]);
    if (so.rowCount === 0) throw new Error("sale order not found");

    const head = await client.query(
      `INSERT INTO invoices(id, iv_no, type, so_id, issue_date, due_date, customer_id, currency, status, remarks)
       VALUES (gen_random_uuid(), next_iv_no($1, CURRENT_DATE), $1, $2, CURRENT_DATE, CURRENT_DATE + INTERVAL '30 day',
               $3, 'THB', $4, 'issued from API')
       RETURNING id, iv_no, type, so_id, status`,
      [type, so_id, so.rows[0].customer_id, status]
    );
    const invoice_id = head.rows[0].id;

    await client.query(
      `INSERT INTO invoice_items(id, invoice_id, so_item_id, description, qty, unit, unit_price, amount_ex_vat, vat_rate)
       SELECT gen_random_uuid(), $1, soi.id, COALESCE(soi.description,'-'), soi.qty, soi.unit, soi.unit_price, soi.amount_ex_vat, 7.0
       FROM sale_order_items soi
       WHERE soi.sale_order_id = $2`,
      [invoice_id, so_id]
    );

    await client.query(
      `UPDATE sale_order_items SET billed_qty = billed_qty + qty WHERE sale_order_id = $1`,
      [so_id]
    );

    await client.query("COMMIT");
    res.json(head.rows[0]);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}));

// ---- STOCK ----
app.get("/api/stock-levels", wrap(async (req, res) => {
  const sku = req.query.sku;
  if (!sku) return res.status(400).json({ error: "sku required" });
  const r = await q(
    `SELECT sl.item_id, sl.wh_id, sl.on_hand, sl.reserved, sl.avg_cost
     FROM stock_levels sl
     JOIN items it ON it.item_id = sl.item_id
     WHERE it.sku = $1
     ORDER BY sl.wh_id`,
    [sku]
  );
  res.json(r.rows);
}));

async function ensureMap(client, sku) {
  try {
    await client.query(`SELECT map_product_to_item_wh($1,'MAIN','FIFO')`, [sku]);
  } catch (_e) {}
}

app.post("/api/stock/in", wrap(async (req, res) => {
  const { sku, qty = 1, note = "UI IN" } = req.body || {};
  if (!sku || Number(qty) <= 0) return res.status(400).json({ error: "sku and positive qty required" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await ensureMap(client, sku);

    const map = await client.query(
      `SELECT m.item_id, m.wh_id
       FROM product_item_wh_map m
       JOIN products p ON p.id = m.product_id
       WHERE p.sku = $1`,
      [sku]
    );
    if (map.rowCount === 0) throw new Error("mapping not found");

    const { item_id, wh_id } = map.rows[0];
    await client.query(
      `INSERT INTO stock_moves(move_type, ref_no, ref_type, item_id, wh_to, qty, unit_cost, note)
       VALUES ('IN', 'UI-IN', 'UI', $1, $2, $3, 0, $4)`,
      [item_id, wh_id, Number(qty), note]
    );

    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}));

app.post("/api/stock/adj", wrap(async (req, res) => {
  const { sku, qty = 0, note = "UI ADJ" } = req.body || {};
  if (!sku || Number(qty) === 0) return res.status(400).json({ error: "sku and non-zero qty required" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await ensureMap(client, sku);

    const map = await client.query(
      `SELECT m.item_id, m.wh_id
       FROM product_item_wh_map m
       JOIN products p ON p.id = m.product_id
       WHERE p.sku = $1`,
      [sku]
    );
    if (map.rowCount === 0) throw new Error("mapping not found");

    const { item_id, wh_id } = map.rows[0];
    if (Number(qty) > 0) {
      await client.query(
        `INSERT INTO stock_moves(move_type, ref_no, ref_type, item_id, wh_to, qty, unit_cost, note)
         VALUES ('IN', 'UI-ADJ+', 'ADJ', $1, $2, $3, 0, $4)`,
        [item_id, wh_id, Number(qty), note]
      );
    } else {
      await client.query(
        `INSERT INTO stock_moves(move_type, ref_no, ref_type, item_id, wh_from, qty, unit_cost, note)
         VALUES ('OUT', 'UI-ADJ-', 'ADJ', $1, $2, $3 * -1, 0, $4)`,
        [item_id, wh_id, Number(qty), note]
      );
    }

    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}));

// ---- REPORTS ----
app.get("/api/reports/stock-trend", wrap(async (req, res) => {
  const sku = req.query.sku;
  if (!sku) return res.status(400).json({ error: "sku required" });

  const r = await q(
    `SELECT sl.on_hand, sl.reserved
     FROM stock_levels sl
     JOIN items it ON it.item_id = sl.item_id
     WHERE it.sku = $1
     LIMIT 1`,
    [sku]
  );
  const on_hand = r.rowCount ? Number(r.rows[0].on_hand) : 0;
  const reserved = r.rowCount ? Number(r.rows[0].reserved) : 0;

  const today = new Date();
  const data = Array.from({ length: 30 }).map((_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (29 - i));
    return { date: d.toISOString().slice(0, 10), on_hand, reserved };
  });
  res.json(data);
}));

// ---- DASHBOARD ----
app.get("/api/dashboard/summary", wrap(async (_req, res) => {
  const soOpen = await q(`SELECT COUNT(*)::int AS c FROM sale_orders WHERE status='confirmed'`);
  const ivIssued = await q(`SELECT COUNT(*)::int AS c FROM invoices WHERE status='issued'`);
  const stockSku = await q(`SELECT COUNT(DISTINCT item_id)::int AS c FROM stock_levels WHERE on_hand > 0`);
  res.json({ soOpen: soOpen.rows[0].c, ivIssued: ivIssued.rows[0].c, stockSku: stockSku.rows[0].c });
}));

// ---- FE aliases for Sales Orders ----
// Create SO (maps FE payload price_ex_vat -> unit_price)
app.post("/api/sales-orders", wrap(async (req, res) => {
  const client = await pool.connect();
  try {
    const { team_id, customer_id, currency = "THB", items = [] } = req.body || {};
    if (!team_id || !customer_id || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "team_id, customer_id, items[] required" });
    }

    await client.query("BEGIN");
    const team = await client.query(`SELECT code FROM teams WHERE id=$1`, [team_id]);
    if (team.rowCount === 0) throw new Error("team not found");
    const team_code = team.rows[0].code;

    const head = await client.query(
      `INSERT INTO sale_orders(id, so_no, team_id, customer_id, issue_date, currency, status, remarks)
       VALUES (gen_random_uuid(), next_so_no($1, CURRENT_DATE), $2, $3, CURRENT_DATE, $4, 'draft', 'created from FE alias')
       RETURNING id, so_no, team_id, customer_id, issue_date, currency, status, created_at`,
      [team_code, team_id, customer_id, currency]
    );
    const so_id = head.rows[0].id;

    for (const it of items) {
      const qty = Number(it.qty || 0);
      const unit_price = it.unit_price != null ? Number(it.unit_price) : Number(it.price_ex_vat || 0);
      const amount_ex_vat = qty * unit_price;
      await client.query(
        `INSERT INTO sale_order_items(id, sale_order_id, product_id, description, qty, unit, unit_price, amount_ex_vat)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7)`,
        [so_id, it.product_id, it.description || "", qty, it.unit || "EA", unit_price, amount_ex_vat]
      );
    }

    await client.query("COMMIT");
    res.json(head.rows[0]);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}));

app.post("/api/sales-orders/:id/confirm", wrap(async (req, res) => {
  const { id } = req.params;
  const r = await q(
    `UPDATE sale_orders SET status='confirmed'
     WHERE id=$1 AND status='draft'
     RETURNING id, so_no, team_id, customer_id, issue_date, currency, status, created_at`,
    [id]
  );
  if (r.rowCount === 0) return res.status(400).json({ error: "cannot confirm (not found or not in draft)" });
  res.json(r.rows[0]);
}));

app.get("/api/sales-orders", wrap(async (req, res) => {
  const status = req.query.status;
  const sql = status
    ? `SELECT id, so_no, status, created_at FROM sale_orders WHERE status=$1 ORDER BY created_at DESC`
    : `SELECT id, so_no, status, created_at FROM sale_orders ORDER BY created_at DESC`;
  const r = await q(sql, status ? [status] : undefined);
  res.json(r.rows);
}));

app.post("/api/sales-orders/:id/issue-iv", wrap(async (req, res) => {
  const so_id = req.params.id;
  const type = (req.body && req.body.type) || "domestic";
  const status = (req.body && req.body.status) || "issued";

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const so = await client.query(`SELECT id, customer_id FROM sale_orders WHERE id=$1`, [so_id]);
    if (so.rowCount === 0) throw new Error("sale order not found");

    const head = await client.query(
      `INSERT INTO invoices(id, iv_no, type, so_id, issue_date, due_date, customer_id, currency, status, remarks)
       VALUES (gen_random_uuid(), next_iv_no($1, CURRENT_DATE), $1, $2, CURRENT_DATE, CURRENT_DATE + INTERVAL '30 day',
               $3, 'THB', $4, 'issued from FE alias')
       RETURNING id, iv_no, type, so_id, status`,
      [type, so_id, so.rows[0].customer_id, status]
    );
    const invoice_id = head.rows[0].id;

    await client.query(
      `INSERT INTO invoice_items(id, invoice_id, so_item_id, description, qty, unit, unit_price, amount_ex_vat, vat_rate)
       SELECT gen_random_uuid(), $1, soi.id, COALESCE(soi.description,'-'), soi.qty, soi.unit, soi.unit_price, soi.amount_ex_vat, 7.0
       FROM sale_order_items soi
       WHERE soi.sale_order_id = $2`,
      [invoice_id, so_id]
    );

    await client.query(
      `UPDATE sale_order_items SET billed_qty = billed_qty + qty WHERE sale_order_id = $1`,
      [so_id]
    );

    await client.query("COMMIT");
    res.json(head.rows[0]);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}));
// ---- USERS (with email autofill) ----
//  LIST
app.get('/api/users', wrap(async (_req, res) => {
  // จะโชว์ email ด้วยก็ได้ ถ้า UI ไม่ใช้ จะไม่กระทบ
  const r = await q(`SELECT id, username, status /*, email*/ FROM users ORDER BY username ASC`);
  res.json(r.rows);
}));

//  CREATE (auto-fill email ถ้าไม่ได้ส่งมา)
app.post('/api/users', wrap(async (req, res) => {
  const { username, password, email, status = 'active' } = req.body || {};
  if (!username || !password)
    return res.status(400).json({ error: 'username & password required' });
  if (!['active','disabled'].includes(status))
    return res.status(400).json({ error: 'status must be active|disabled' });

  const uname = String(username).trim();

  // เติม email อัตโนมัติจาก username → username@local
  let mail = (email ? String(email) : `${uname}@local`).trim().toLowerCase();
  // กันรูปแบบแปลก ๆ ให้มีโดเมนกับจุดอย่างน้อย
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) {
    if (!mail.includes('@')) mail = `${mail}@local`;
    const domain = mail.split('@')[1] || '';
    if (!domain.includes('.')) mail = mail.replace(/@(.*)$/, '@$1.local');
  }

  try {
    const r = await q(
      `INSERT INTO users(id, email, username, password_hash, status)
       VALUES (gen_random_uuid(), $1, $2, crypt($3, gen_salt('bf')), $4)
       RETURNING id, username, status`,
      [mail, uname, password, status]
    );
    res.json(r.rows[0]);
  } catch (e) {
    // 23505 = unique_violation (username/email ซ้ำ)
    if (e && e.code === '23505')
      return res.status(409).json({ error: 'username or email already exists' });
    throw e;
  }
}));

//  UPDATE (รองรับแก้ password / status / email)
app.patch('/api/users/:id', wrap(async (req, res) => {
  const { id } = req.params;
  const { password, status, email } = req.body || {};
  if (!password && !status && !email)
    return res.status(400).json({ error: 'nothing to update' });
  if (status && !['active','disabled'].includes(status))
    return res.status(400).json({ error: 'status must be active|disabled' });

  const fields = [];
  const params = [];
  let i = 1;

  if (password) { fields.push(`password_hash = crypt($${i++}, gen_salt('bf'))`); params.push(password); }
  if (typeof status === 'string') { fields.push(`status = $${i++}`); params.push(status); }
  if (typeof email === 'string') {
    let mail = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) {
      if (!mail.includes('@')) mail = `${mail}@local`;
      const domain = mail.split('@')[1] || '';
      if (!domain.includes('.')) mail = mail.replace(/@(.*)$/, '@$1.local');
    }
    fields.push(`email = $${i++}`); params.push(mail);
  }

  const sql = `UPDATE users SET ${fields.join(', ')} WHERE id = $${i} RETURNING id, username, status`;
  params.push(id);

  try {
    const r = await q(sql, params);
    if (!r.rowCount) return res.status(404).json({ error: 'not found' });
    res.json(r.rows[0]);
  } catch (e) {
    if (e && e.code === '23505')
      return res.status(409).json({ error: 'username or email already exists' });
    throw e;
  }
}));

//  DELETE
app.delete('/api/users/:id', wrap(async (req, res) => {
  const { id } = req.params;
  const r = await q(`DELETE FROM users WHERE id=$1`, [id]);
  res.json({ ok: r.rowCount > 0 });
}));
// ---- ERROR HANDLER ----
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: String(err?.message || err) });
});

app.listen(PORT, () => {
  console.log(`[SVS-Ops] API listening on :${PORT}`);
});

