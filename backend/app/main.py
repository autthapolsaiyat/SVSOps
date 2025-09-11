from __future__ import annotations
import os, asyncio, importlib, importlib.util, logging, inspect
from typing import Optional
from datetime import datetime, timezone
import io, csv
import httpx
import sqlalchemy as sa
from fastapi import FastAPI
from fastapi import HTTPException, APIRouter, Request, Depends, HTTPException, APIRouter, Request, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import create_async_engine
from pydantic import BaseModel
log = logging.getLogger("uvicorn.error")
from .runtime import API_PREFIX, engine as _engine, resolve_current_user as _resolve_current_user, roles_of as _roles_of

# ---- Dev auth fallback (ปล่อยผ่านเฉพาะตอน dev) ----
async def _user_or_dev(request: Request):
    # ALLOW_DEV_OPEN=1 (default) จะ bypass ถ้า auth ใช้งานไม่ได้
    allow = os.environ.get("ALLOW_DEV_OPEN","1") == "1"
    try:
        # ถ้ามีตัวแก้ก่อนหน้า ให้ลองใช้ก่อน
        if "async def _resolve_current_user" in globals() or "_resolve_current_user" in dir():
            try:
                return await _resolve_current_user(request)  # type: ignore
            except Exception:
                if not allow: raise
        # พยายามหา provider ใน auth.py แบบไดนามิก (รองรับหลายชื่อ/ซิกเนเจอร์)
        mod = importlib.import_module("app.routers.auth")
        cands=("get_current_user","get_current_user_or_401","current_user","require_user","get_user","get_me")
        # เอา token จาก header ถ้าเจอ
        auth = request.headers.get("authorization") or request.headers.get("Authorization") or ""
        token = auth.split(None,1)[1].strip() if auth.lower().startswith("bearer ") else None
        for name in cands:
            fn = getattr(mod, name, None)
            if not fn: continue
            import inspect as _ins
            sig=_ins.signature(fn)
            kwargs={}
            ok=True
            for prm in sig.parameters.values():
                n=prm.name
                if n=="request": kwargs[n]=request
                elif n=="token": kwargs[n]=token
                elif prm.default is not prm.empty:
                    # มี default/Depends ปล่อยให้ใช้ค่า default ไป (เราไม่ inject เอง)
                    pass
                else:
                    ok=False; break   # มีพารามิเตอร์บังคับที่เราให้ไม่ได้
            if not ok: continue
            res=fn(**kwargs)
            if _ins.isawaitable(res): res=await res
            return res
        if not allow:
            raise HTTPException(status_code=401, detail="auth unavailable")
    except HTTPException:
        raise
    except Exception:
        if not allow:
            raise
    # ---- DEV BYPASS (admin/superadmin) ----
    return {"id":"dev","role_names":["admin","superadmin"]}


# ---- Auth dependency (robust resolver) ----
async def _resolve_current_user(request: Request):
    try:
        mod = importlib.import_module("app.routers.auth")
        # ไล่ลองหลายชื่อที่อาจมีใน auth.py
        for name in ("get_current_user","get_current_user_or_401","current_user","require_user","get_user","get_me"):
            fn = getattr(mod, name, None)
            if fn:
                return (await fn(request)) if inspect.iscoroutinefunction(fn) else fn(request)
        raise RuntimeError("no current_user provider in app.routers.auth")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"auth unavailable: {type(e).__name__}")
# API_PREFIX moved to app.runtime
security = HTTPBearer(auto_error=False)

app = FastAPI(
    title="SVS-Ops API",
    version="0.1.0",
    docs_url=f"{API_PREFIX}/docs",
    redoc_url=None,
    openapi_url=f"{API_PREFIX}/openapi.json",
)
# ---- CORS ----
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+)(?::\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# ---- DB /ready ----
DATABASE_URL = os.environ.get("DATABASE_URL")
_engine = create_async_engine(DATABASE_URL, echo=False, pool_pre_ping=True) if DATABASE_URL else None
sys_router = APIRouter()
@sys_router.get("/health")
def health():
    return {"ok": True}
@sys_router.get("/ready")
async def ready():
    if not _engine:
        raise HTTPException(status_code=503, detail="DATABASE_URL not set")
    try:
        async with _engine.connect() as conn:
            await asyncio.wait_for(conn.execute(sa.text("select 1")), timeout=3.0)
        return {"ready": True}
    except asyncio.TimeoutError:
        raise HTTPException(status_code=503, detail="DB ping timed out")
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"DB not ready: {type(e).__name__}: {e}")

@app.on_event("startup")
async def _ensure_customer_vendor_tables():
    try:
        import sqlalchemy as sa
        from app.runtime import engine as _engine
        ddls = [
            # customers
            "CREATE TABLE IF NOT EXISTS customers (code TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now())",
            "CREATE TABLE IF NOT EXISTS customers_meta (code TEXT PRIMARY KEY REFERENCES customers(code) ON DELETE CASCADE, team_code TEXT, group_code TEXT, group_name TEXT, is_active BOOLEAN DEFAULT TRUE)",
            "CREATE INDEX IF NOT EXISTS idx_customers_name ON customers (name)",
            # vendors
            "CREATE TABLE IF NOT EXISTS vendors (code TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now())",
            "CREATE TABLE IF NOT EXISTS vendors_meta (code TEXT PRIMARY KEY REFERENCES vendors(code) ON DELETE CASCADE, team_code TEXT, group_code TEXT, group_name TEXT, is_active BOOLEAN DEFAULT TRUE)",
            "CREATE INDEX IF NOT EXISTS idx_vendors_name ON vendors (name)",
        ]
        async with _engine.begin() as conn:
            for sql in ddls:
                await conn.execute(sa.text(sql))
        log.info("Customers/Vendors tables ensured.")
    except Exception as e:
        log.exception("Ensure customers/vendors failed: %s", e)


app.include_router(sys_router, prefix=API_PREFIX)
# ---- safe include helper ----
def safe_include(module_path: str, *, prefix: str = API_PREFIX, attr: str = "router"):
    try:
        if importlib.util.find_spec(module_path) is None:
            log.warning("Skip include: %s (module not found)", module_path); return
        mod = importlib.import_module(module_path)
        router = getattr(mod, attr, None)
        if router is None:
            log.warning("Skip include: %s (attr %s not found)", module_path, attr); return
        app.include_router(router, prefix=prefix)
        log.info("Included router: %s", module_path)
    except Exception as e:
        log.exception("Failed to include router %s: %s", module_path, e)
# ---- include ของเดิมที่ยังต้องใช้ ----
safe_include("app.routers.health")
safe_include("app.routers.auth")
safe_include("app.routers.admin_users")
safe_include("app.routers.inventory")
safe_include("app.routers.sessions")
safe_include("app.routers.admin_sessions")
# <<< เอา compat ขึ้นมาก่อน เพื่อให้ endpoint summary ที่ไม่ต้อง auth ชนะ
safe_include("app.routers.stock_ui_compat")
safe_include("app.routers.customers_ui_compat")
safe_include("app.routers.vendors_ui_compat")
# ของเดิมที่อาจซ้ำ path
safe_include("app.routers.dashboard")
safe_include("app.routers.quotations")
safe_include("app.routers.purchases")
safe_include("app.routers.quotation_pdf")
safe_include("app.routers.quote_catalog")
safe_include("app.routers.shim")
safe_include("app.routers.shim_admin")
safe_include("app.routers.debug")
safe_include("app.routers.sales")
# =============================================================================
# INLINE ENDPOINTS (Products / Stock card / Products helpers / Ledger hooks / Reports)
# =============================================================================
# ---- Auth dependency (lazy import กัน forward/circular) ----
# (disabled) _current_user_dep was replaced by Depends(_user_or_dev)

def _roles_of(u):
    try:
        roles = []
        if isinstance(u, dict):
            roles = u.get("roles") or u.get("role_names") or []
        else:
            roles = getattr(u, "roles", None) or getattr(u, "role_names", None) or []
        out = set()
        for r in (roles or []):
            if isinstance(r, str):
                out.add(r)
            elif isinstance(r, dict):
                name = r.get("name") or r.get("role")
                if name: out.add(name)
            else:
                name = getattr(r, "name", None) or getattr(r, "role", None)
                if name: out.add(name)
        return out
    except Exception:
        return set()
# -------- products: upsert / get / list --------
class UpsertProductBody(BaseModel):
    sku: str
    name: str
    unit: str
    team_code: Optional[str] = None
    group_code: Optional[str] = None
    group_name: Optional[str] = None
    is_domestic: Optional[bool] = None
    group_tag: Optional[str] = None
@app.post(f"{API_PREFIX}/products/upsert")
async def products_upsert(body: UpsertProductBody, user=Depends(_user_or_dev)):
    if not (_roles_of(user) & {"admin", "superadmin"}):
        raise HTTPException(status_code=403, detail="forbidden")
    if not _engine:
        raise HTTPException(status_code=503, detail="DATABASE_URL not set")
    sql = sa.text("""
      SELECT upsert_product_with_codes(
        :sku,:name,:unit,:team_code,:group_code,:group_name,:is_domestic,:group_tag
      )
    """)
    try:
        async with _engine.begin() as conn:
            res = await conn.execute(sql, body.dict())
            pid = res.scalar()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB error: {type(e).__name__}: {e}")
    return {"ok": True, "id": str(pid)}
@app.get(f"{API_PREFIX}/products/get")
async def products_get(sku: str):
    if not _engine:
        raise HTTPException(status_code=503, detail="DATABASE_URL not set")
    sql = sa.text("""
      SELECT sku, name, unit, team_code, group_code, group_name, is_domestic, group_tag
      FROM v_products_full
      WHERE sku = :sku
      LIMIT 1
    """)
    try:
        async with _engine.connect() as conn:
            row = (await conn.execute(sql, {"sku": sku})).first()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB error: {type(e).__name__}: {e}")
    if not row:
        return {"item": None}
    return {"item": {
      "sku": row[0], "name": row[1], "unit": row[2],
      "team_code": row[3], "group_code": row[4], "group_name": row[5],
      "is_domestic": row[6], "group_tag": row[7]
    }}
@app.get(f"{API_PREFIX}/products/list")
async def products_list(
    q: Optional[str] = None,
    team_code: Optional[str] = None,
    group_code: Optional[str] = None,
    origin: Optional[str] = None,  # 'domestic' | 'foreign' | 'unassigned' | None
    limit: int = 20,
    offset: int = 0,
):
    if not _engine:
        raise HTTPException(status_code=503, detail="DATABASE_URL not set")
    conds = []
    params = {"limit": max(1, min(limit, 200)), "offset": max(0, offset)}
    if q:
        conds.append("(sku ILIKE :q OR name ILIKE :q)")
        params["q"] = f"%{q}%"
    if team_code:
        conds.append("team_code = :team")
        params["team"] = team_code
    if group_code:
        conds.append("group_code = :grp")
        params["grp"] = group_code
    if origin:
        o = origin.lower()
        if o == "domestic":
            conds.append("is_domestic IS TRUE")
        elif o == "foreign":
            conds.append("is_domestic IS FALSE")
        elif o == "unassigned":
            conds.append("(group_code IS NULL OR is_domestic IS NULL)")
    where = "WHERE " + " AND ".join(conds) if conds else ""
    sql = sa.text(f"""
      SELECT sku, name, unit, team_code, group_code, group_name, is_domestic, group_tag
      FROM v_products_full
      {where}
      ORDER BY sku
      LIMIT :limit OFFSET :offset
    """)
    sql_count = sa.text(f"SELECT COUNT(*) FROM v_products_full {where}")
    try:
        async with _engine.connect() as conn:
            total = (await conn.execute(sql_count, params)).scalar_one()
            rows  = (await conn.execute(sql, params)).all()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB error: {type(e).__name__}: {e}")
    items = [{
        "sku": r[0], "name": r[1], "unit": r[2],
        "team_code": r[3], "group_code": r[4], "group_name": r[5],
        "is_domestic": r[6], "group_tag": r[7]
    } for r in rows]
    return {"items": items, "total": total}
# -------- stock card --------
@app.get(f"{API_PREFIX}/stock/card")
async def stock_card(
    request: Request,
    sku: str,
    wh: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    limit: int = 200
):
    if not _engine:
        raise HTTPException(status_code=503, detail="DATABASE_URL not set")
    limit = max(1, min(limit, 2000))
    df_val = f"{date_from} 00:00:00" if date_from else None
    dt_val = f"{date_to} 23:59:59"   if date_to   else None
    async with _engine.connect() as conn:
        item_row = (await conn.execute(
            sa.text("SELECT item_id FROM items WHERE sku = :sku LIMIT 1"),
            {"sku": sku}
        )).first()
        item_id = item_row[0] if item_row else None
        has_sm = False
        if item_id:
            sm_count = (await conn.execute(
                sa.text("SELECT COUNT(*) FROM stock_moves WHERE item_id = :iid"),
                {"iid": item_id}
            )).scalar_one()
            has_sm = sm_count > 0
        rows = []
        if has_sm:
            params = {"iid": item_id, "limit": limit, "sku": sku}
            conds = ["m.item_id = :iid"]
            if df_val: conds.append("m.moved_at >= CAST(:df AS timestamp)"); params["df"] = df_val
            if dt_val: conds.append("m.moved_at <= CAST(:dt AS timestamp)"); params["dt"] = dt_val
            wh_filter = ""
            if wh:     wh_filter = " AND (wt.wh_code = :wh OR wf.wh_code = :wh)"; params["wh"] = wh
            where = "WHERE " + " AND ".join(conds) + wh_filter
            sql = sa.text(f"""
              SELECT to_char(m.moved_at, 'YYYY-MM-DD HH24:MI:SS') AS moved_at,
                     m.move_type, :sku AS sku,
                     COALESCE(wt.wh_code, wf.wh_code) AS wh,
                     COALESCE(m.qty,0) AS qty, m.unit_cost, m.ref_no AS ref, m.note
              FROM stock_moves m
              LEFT JOIN warehouses wf ON wf.wh_id = m.wh_from
              LEFT JOIN warehouses wt ON wt.wh_id = m.wh_to
              {where}
              ORDER BY m.moved_at ASC
              LIMIT :limit
            """)
            rows = (await conn.execute(sql, params)).all()
        else:
            auto_cols = [r[0].lower() for r in (await conn.execute(sa.text("""
                SELECT column_name FROM information_schema.columns
                WHERE table_schema = current_schema() AND table_name='stock_moves_auto'
            """))).all()]
            prod_cols = [r[0].lower() for r in (await conn.execute(sa.text("""
                SELECT column_name FROM information_schema.columns
                WHERE table_schema = current_schema() AND table_name='products'
            """))).all()]
            need_auto = {"moved_at","move_type","product_id","qty","ref_no"}
            need_prod = {"id","sku"}
            if need_auto.issubset(set(auto_cols)) and need_prod.issubset(set(prod_cols)):
                params = {"sku": sku, "limit": limit}
                conds = ["p.sku = :sku"]
                if df_val: conds.append("m.moved_at >= CAST(:df AS timestamp)"); params["df"] = df_val
                if dt_val: conds.append("m.moved_at <= CAST(:dt AS timestamp)"); params["dt"] = dt_val
                where = "WHERE " + " AND ".join(conds)
                sql = sa.text(f"""
                  SELECT to_char(m.moved_at, 'YYYY-MM-DD HH24:MI:SS') AS moved_at,
                         m.move_type, p.sku AS sku,
                         NULL::text AS wh, COALESCE(m.qty,0) AS qty,
                         NULL::numeric AS unit_cost, m.ref_no AS ref, NULL::text AS note
                  FROM stock_moves_auto m
                  JOIN products p ON p.id = m.product_id
                  {where}
                  ORDER BY m.moved_at ASC
                  LIMIT :limit
                """)
                rows = (await conn.execute(sql, params)).all()
    items = [{
        "moved_at": r[0], "move_type": r[1], "sku": r[2], "wh": r[3],
        "qty": float(r[4] or 0), "unit_cost": (float(r[5]) if r[5] is not None else None),
        "ref": r[6], "note": r[7],
    } for r in rows]
    if request.query_params.get("format") == "csv":
        buf = io.StringIO(); w = csv.writer(buf)
        w.writerow(["moved_at","move_type","sku","wh","qty","unit_cost","ref","note"])
        for it in items:
            w.writerow([it["moved_at"], it["move_type"], it["sku"], it["wh"] or "",
                        it["qty"], it["unit_cost"] if it["unit_cost"] is not None else "",
                        it["ref"] or "", it["note"] or ""])
        buf.seek(0)
        return StreamingResponse(buf, media_type="text/csv",
                                 headers={"Content-Disposition":"attachment; filename=stock_card.csv"})
    return {"items": items}
# ===== Products helpers =====
class ToggleBody(BaseModel):
    sku: str
    is_active: bool
@app.post(f"{API_PREFIX}/products/active")
async def products_toggle_active(body: ToggleBody, user=Depends(_user_or_dev)):
    if not (_roles_of(user) & {"admin","superadmin"}):
        raise HTTPException(status_code=403, detail="forbidden")
    if not _engine:
        raise HTTPException(status_code=503, detail="DATABASE_URL not set")
    sql = sa.text("UPDATE products SET is_active=:v WHERE sku=:sku")
    try:
        async with _engine.begin() as conn:
            await conn.execute(sql, {"v": body.is_active, "sku": body.sku})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB error: {type(e).__name__}: {e}")
    return {"ok": True}
@app.get(f"{API_PREFIX}/products/teams")
async def products_teams():
    if not _engine:
        raise HTTPException(status_code=503, detail="DATABASE_URL not set")
    sql = sa.text("""
      SELECT code, COALESCE(name_th, name, code) AS label
      FROM teams
      WHERE status IS NULL OR status = 'active'
      ORDER BY code
    """)
    async with _engine.connect() as conn:
        rows = (await conn.execute(sql)).all()
    return {"items": [{"code": r[0], "label": r[1]} for r in rows]}
@app.get(f"{API_PREFIX}/products/groups")
async def products_groups():
    if not _engine:
        raise HTTPException(status_code=503, detail="DATABASE_URL not set")
    sql = sa.text("""
      SELECT code, name
      FROM product_groups
      ORDER BY code
    """)
    async with _engine.connect() as conn:
        rows = (await conn.execute(sql)).all()
    return {"items": [{"code": r[0], "name": r[1]} for r in rows]}
# ===== Ledger hooks =====
class LogRecvBody(BaseModel):
    sku: str; wh: str; qty: float; unit_cost: float
    ref: Optional[str] = None; note: Optional[str] = None
class LogIssueBody(BaseModel):
    sku: str; wh: str; qty: float
    unit_cost: Optional[float] = None; ref: Optional[str] = None; note: Optional[str] = None
@app.post(f"{API_PREFIX}/stock/log-receive")
async def stock_log_receive(body: LogRecvBody, user=Depends(_user_or_dev)):
    if not (_roles_of(user) & {"stock","admin","superadmin"}):
        raise HTTPException(status_code=403, detail="forbidden")
    if not _engine: raise HTTPException(status_code=503, detail="DATABASE_URL not set")
    sql = sa.text("""
      WITH itm AS (SELECT item_id FROM items WHERE sku=:sku),
           w   AS (SELECT wh_id FROM warehouses WHERE wh_code=:wh)
      INSERT INTO stock_moves (
        move_id, move_type, ref_no, ref_type, item_id, wh_from, wh_to, batch_id,
        qty, unit_cost, moved_at, created_by, request_id, note
      )
      SELECT gen_random_uuid(), 'IN', :ref, 'UI',
             itm.item_id, NULL, w.wh_id, NULL,
             :qty, :unit_cost, now(), 'ui', NULL, :note
      FROM itm, w
    """)
    async with _engine.begin() as conn:
        await conn.execute(sql, body.dict())
    return {"ok": True}
@app.post(f"{API_PREFIX}/stock/log-issue")
async def stock_log_issue(body: LogIssueBody, user=Depends(_user_or_dev)):
    if not (_roles_of(user) & {"stock","admin","superadmin"}):
        raise HTTPException(status_code=403, detail="forbidden")
    if not _engine: raise HTTPException(status_code=503, detail="DATABASE_URL not set")
    sql_cost = sa.text("""
      WITH itm AS (SELECT item_id FROM items WHERE sku=:sku),
           w   AS (SELECT wh_id FROM warehouses WHERE wh_code=:wh)
      SELECT m.unit_cost
      FROM stock_moves m JOIN itm ON itm.item_id = m.item_id
      WHERE m.move_type='IN' AND m.wh_to = (SELECT wh_id FROM w)
      ORDER BY m.moved_at DESC
      LIMIT 1
    """)
    sql = sa.text("""
      WITH itm AS (SELECT item_id FROM items WHERE sku=:sku),
           w   AS (SELECT wh_id FROM warehouses WHERE wh_code=:wh)
      INSERT INTO stock_moves (
        move_id, move_type, ref_no, ref_type, item_id, wh_from, wh_to, batch_id,
        qty, unit_cost, moved_at, created_by, request_id, note
      )
      SELECT gen_random_uuid(), 'OUT', :ref, 'UI',
             itm.item_id, w.wh_id, NULL, NULL,
             :qty, :unit_cost, now(), 'ui', NULL, :note
      FROM itm, w
    """)
    async with _engine.begin() as conn:
        unit_cost = body.unit_cost
        if unit_cost is None:
            r = (await conn.execute(sql_cost, {"sku": body.sku, "wh": body.wh})).first()
            unit_cost = float(r[0]) if r and r[0] is not None else 0.0
        await conn.execute(sql, {
            "sku": body.sku, "wh": body.wh, "qty": body.qty,
            "unit_cost": unit_cost, "ref": body.ref, "note": body.note
        })
    return {"ok": True}
# ===== Reports CSV: Balance / Valuation =====
def _asof_dt(v: str) -> datetime:
    v = (v or "").strip()
    if not v: return datetime.now(timezone.utc)
    try:
        if "T" in v or " " in v:
            vv = v.replace("Z", "+00:00")
            return datetime.fromisoformat(vv).astimezone(timezone.utc)
        d = datetime.fromisoformat(v + "T23:59:59+00:00")
        return d.astimezone(timezone.utc)
    except Exception:
        now = datetime.now(timezone.utc)
        return now.replace(hour=23, minute=59, second=59, microsecond=0)
@app.get(f"{API_PREFIX}/reports/stock/balance")
async def report_stock_balance(as_of: str, sku: Optional[str] = None, wh: Optional[str] = None):
    if not _engine: raise HTTPException(status_code=503, detail="DATABASE_URL not set")
    asof = _asof_dt(as_of)
    include_auto = wh is None
    async with _engine.connect() as conn:
        params = {"asof": asof}
        conds_sm = ["m.moved_at <= :asof"]
        if sku: conds_sm.append("i.sku = :sku"); params["sku"] = sku
        if wh:  conds_sm.append("(COALESCE(wt.wh_code, wf.wh_code) = :wh)"); params["wh"] = wh
        where_sm = "WHERE " + " AND ".join(conds_sm)
        sql_sm = f"""
          SELECT i.sku AS sku, COALESCE(wt.wh_code, wf.wh_code) AS wh,
                 CASE WHEN m.move_type='IN' THEN m.qty ELSE -m.qty END AS q
          FROM stock_moves m
          JOIN items i ON i.item_id = m.item_id
          LEFT JOIN warehouses wf ON wf.wh_id = m.wh_from
          LEFT JOIN warehouses wt ON wt.wh_id = m.wh_to
          {where_sm}
        """
        if include_auto:
            conds_auto = ["m.moved_at <= :asof"]
            if sku: conds_auto.append("p.sku = :sku")
            where_auto = "WHERE " + " AND ".join(conds_auto)
            sql = sa.text(f"""
              WITH mv AS (
                {sql_sm}
                UNION ALL
                SELECT p.sku AS sku, NULL::text AS wh,
                       CASE WHEN m.move_type='IN' THEN m.qty ELSE -m.qty END AS q
                FROM stock_moves_auto m
                JOIN products p ON p.id = m.product_id
                {where_auto}
              )
              SELECT sku, wh, COALESCE(SUM(q),0) AS on_hand
              FROM mv
              GROUP BY sku, wh
              ORDER BY sku, wh NULLS LAST
            """)
        else:
            sql = sa.text(f"""
              WITH mv AS (
                {sql_sm}
              )
              SELECT sku, wh, COALESCE(SUM(q),0) AS on_hand
              FROM mv
              GROUP BY sku, wh
              ORDER BY sku, wh NULLS LAST
            """)
        rows = (await conn.execute(sql, params)).all()
    buf = io.StringIO(); w = csv.writer(buf)
    w.writerow(["sku","wh","on_hand"])
    for r in rows:
        w.writerow([r[0], r[1] or "", float(r[2] or 0)])
    buf.seek(0)
    return StreamingResponse(buf, media_type="text/csv",
                             headers={"Content-Disposition":"attachment; filename=stock_balance.csv"})
@app.get(f"{API_PREFIX}/reports/stock/valuation")
async def report_stock_valuation(as_of: str, sku: Optional[str] = None, wh: Optional[str] = None):
    if not _engine: raise HTTPException(status_code=503, detail="DATABASE_URL not set")
    asof = _asof_dt(as_of)
    include_auto = wh is None
    async with _engine.connect() as conn:
        params = {"asof": asof}
        conds_sm = ["m.moved_at <= :asof"]
        if sku: conds_sm.append("i.sku = :sku"); params["sku"] = sku
        if wh:  conds_sm.append("(COALESCE(wt.wh_code, wf.wh_code) = :wh)"); params["wh"] = wh
        where_sm = "WHERE " + " AND ".join(conds_sm)
        sql_onh_sm = f"""
          SELECT i.sku AS sku, COALESCE(wt.wh_code, wf.wh_code) AS wh,
                 CASE WHEN m.move_type='IN' THEN m.qty ELSE -m.qty END AS q
          FROM stock_moves m
          JOIN items i ON i.item_id = m.item_id
          LEFT JOIN warehouses wf ON wf.wh_id = m.wh_from
          LEFT JOIN warehouses wt ON wt.wh_id = m.wh_to
          {where_sm}
        """
        sql_avg_sm = f"""
          SELECT i.sku AS sku, COALESCE(wt.wh_code, wf.wh_code) AS wh,
                 COALESCE(SUM(CASE WHEN m.move_type='IN' THEN m.qty*COALESCE(m.unit_cost,0) END),0) AS sum_cost,
                 COALESCE(SUM(CASE WHEN m.move_type='IN' THEN m.qty END),0) AS sum_qty
          FROM stock_moves m
          JOIN items i ON i.item_id = m.item_id
          LEFT JOIN warehouses wf ON wf.wh_id = m.wh_from
          LEFT JOIN warehouses wt ON wt.wh_id = m.wh_to
          {where_sm}
          GROUP BY i.sku, COALESCE(wt.wh_code, wf.wh_code)
        """
        if include_auto:
            sql = sa.text(f"""
              WITH onh AS (
                {sql_onh_sm}
                UNION ALL
                SELECT p.sku AS sku, NULL::text AS wh,
                       CASE WHEN m.move_type='IN' THEN m.qty ELSE -m.qty END AS q
                FROM stock_moves_auto m
                JOIN products p ON p.id = m.product_id
                WHERE m.moved_at <= :asof
                { " AND p.sku = :sku" if "sku" in params else "" }
              ),
              onh_sum AS (
                SELECT sku, wh, COALESCE(SUM(q),0) AS on_hand
                FROM onh GROUP BY sku, wh
              ),
              avg_sm AS (
                {sql_avg_sm}
              )
              SELECT o.sku, o.wh, o.on_hand,
                     CASE WHEN a.sum_qty>0 THEN a.sum_cost/a.sum_qty ELSE 0 END AS avg_cost,
                     o.on_hand * CASE WHEN a.sum_qty>0 THEN a.sum_cost/a.sum_qty ELSE 0 END AS value
              FROM onh_sum o
              LEFT JOIN avg_sm a ON (o.sku=a.sku AND (o.wh IS NOT DISTINCT FROM a.wh))
              ORDER BY o.sku, o.wh NULLS LAST
            """)
        else:
            sql = sa.text(f"""
              WITH onh AS (
                {sql_onh_sm}
              ),
              onh_sum AS (
                SELECT sku, wh, COALESCE(SUM(q),0) AS on_hand
                FROM onh GROUP BY sku, wh
              ),
              avg_sm AS (
                {sql_avg_sm}
              )
              SELECT o.sku, o.wh, o.on_hand,
                     CASE WHEN a.sum_qty>0 THEN a.sum_cost/a.sum_qty ELSE 0 END AS avg_cost,
                     o.on_hand * CASE WHEN a.sum_qty>0 THEN a.sum_cost/a.sum_qty ELSE 0 END AS value
              FROM onh_sum o
              LEFT JOIN avg_sm a ON (o.sku=a.sku AND (o.wh IS NOT DISTINCT FROM a.wh))
              ORDER BY o.sku, o.wh NULLS LAST
            """)
        rows = (await conn.execute(sql, params)).all()
    buf = io.StringIO(); w = csv.writer(buf)
    w.writerow(["sku","wh","on_hand","avg_cost","value"])
    for r in rows:
        w.writerow([r[0], r[1] or "", float(r[2] or 0), float(r[3] or 0), float(r[4] or 0)])
    buf.seek(0)
    return StreamingResponse(buf, media_type="text/csv",
                             headers={"Content-Disposition":"attachment; filename=stock_valuation.csv"})

# ---- Dashboard summary endpoints (reports + alias) ----
async def _table_exists(conn, name: str) -> bool:
    q = sa.text("""
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = current_schema() AND table_name = :name
        )
    """)
    return bool((await conn.execute(q, {"name": name})).scalar())

async def _count_rows(conn, name: str) -> int:
    if not await _table_exists(conn, name):
        return 0
    q = sa.text(f"SELECT COUNT(*) FROM {name}")
    return int((await conn.execute(q)).scalar() or 0)

@app.get(f"{API_PREFIX}/reports/dashboard")
async def reports_dashboard():
    # ค่าเริ่มต้น ถ้าไม่มี DB ก็คืน 0 ทั้งหมด
    data = {
        "sales_today": 0,
        "orders_today": 0,
        "quotes_today": 0,
        "stock_items": 0,
        "po_pending": 0,
        "invoice_today": 0,
        "invoice_pending": 0,
    }
    if not _engine:
        return data
    try:
        async with _engine.connect() as conn:
            # นับจำนวนสินค้า: products ถ้ามี, ไม่งั้นลอง items
            stock_items = await _count_rows(conn, "products")
            if stock_items == 0:
                stock_items = await _count_rows(conn, "items")
            data["stock_items"] = stock_items
            # ช่องอื่นยังไม่ผูกจริง คืน 0 ไปก่อน (จะมาเติมภายหลัง)
    except Exception:
        pass
    return data

# alias ที่บาง FE ใช้
@app.get(f"{API_PREFIX}/dashboard/summary")
async def dashboard_summary():
    return await reports_dashboard()

# expose OpenAPI/Docs under /api for proxy
app.openapi_url = f"{API_PREFIX}/openapi.json"
app.docs_url = f"{API_PREFIX}/docs"
app.redoc_url = f"{API_PREFIX}/redoc"
