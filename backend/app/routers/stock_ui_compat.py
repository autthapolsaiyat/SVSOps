from __future__ import annotations
import os, asyncio
import sqlalchemy as sa
from sqlalchemy.ext.asyncio import create_async_engine
from fastapi import APIRouter, HTTPException, Request, Depends, Query
from typing import Optional, List
import httpx

API_PREFIX = "/api"
router = APIRouter()
DATABASE_URL = os.environ.get("DATABASE_URL")
_engine = create_async_engine(DATABASE_URL, echo=False, pool_pre_ping=True) if DATABASE_URL else None

# auth: ตรวจ token ผ่าน /api/auth/me ภายใน container (127.0.0.1:8000)
async def _auth_via_me(request: Request):
    auth = request.headers.get("authorization", "")
    if not auth.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    try:
        async with httpx.AsyncClient(base_url="http://127.0.0.1:8000", timeout=3.0) as c:
            r = await c.get(f"{API_PREFIX}/auth/me", headers={"authorization": auth})
        if r.status_code != 200:
            raise HTTPException(status_code=401, detail="invalid token")
        return r.json()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail="auth unavailable")

# meta table: เก็บข้อมูลเสริมของสินค้า
_META_SQL_CREATE = """
CREATE TABLE IF NOT EXISTS products_meta (
  sku TEXT PRIMARY KEY,
  team_code TEXT,
  group_code TEXT,
  group_name TEXT,
  is_domestic BOOLEAN,
  group_tag TEXT,
  team_id UUID NULL
);
"""
_META_SQL_UPSERT = """
INSERT INTO products_meta (sku, team_code, group_code, group_name, is_domestic, group_tag, team_id)
VALUES (:sku, :team_code, :group_code, :group_name, :is_domestic, :group_tag, :team_id)
ON CONFLICT (sku) DO UPDATE SET
  team_code=EXCLUDED.team_code,
  group_code=EXCLUDED.group_code,
  group_name=EXCLUDED.group_name,
  is_domestic=EXCLUDED.is_domestic,
  group_tag=EXCLUDED.group_tag,
  team_id=EXCLUDED.team_id;
"""

# ---------- Endpoints ----------
@router.post(f"{API_PREFIX}/products/upsert")
async def products_upsert(
    body: dict,
    request: Request,
    user = Depends(_auth_via_me)
):
    # require admin/superadmin
    roles = {*(user.get("roles") or []), *(user.get("role_names") or [])}
    roles = {str(r).lower() for r in roles}
    if not ({"admin","superadmin"} & roles):
        raise HTTPException(status_code=403, detail="forbidden")

    if not _engine:
        raise HTTPException(status_code=503, detail="DATABASE_URL not set")

    sku         = (body.get("sku") or "").strip()
    name        = (body.get("name") or "").strip()
    unit        = (body.get("unit") or "").strip() or "EA"
    team_code   = (body.get("team_code") or "").strip() or None
    group_code  = (body.get("group_code") or "").strip() or None
    group_name  = (body.get("group_name") or "").strip() or None
    is_domestic = body.get("is_domestic")
    group_tag   = (body.get("group_tag") or "").strip() or None

    # team_id: จาก header X-Team-Id หรือ body.team_id
    team_id = body.get("team_id") or request.headers.get("x-team-id")
    team_id = str(team_id) if team_id else None

    if not sku or not name or not unit:
        raise HTTPException(status_code=422, detail="sku/name/unit required")

    # ใช้ฟังก์ชันเดิมใน DB ถ้ามี (สอดคล้องเวอร์ชันก่อนหน้า)
    sql_upsert = sa.text("""
      SELECT upsert_product_with_codes(
        :sku, :name, :unit, :team_code, :group_code, :group_name, :is_domestic, :group_tag
      )
    """)

    async with _engine.begin() as conn:
        # สร้าง meta table และ upsert meta
        await conn.execute(sa.text(_META_SQL_CREATE))
        _ = await conn.execute(sql_upsert, {
            "sku": sku, "name": name, "unit": unit,
            "team_code": team_code, "group_code": group_code,
            "group_name": group_name, "is_domestic": is_domestic,
            "group_tag": group_tag,
        })
        await conn.execute(sa.text(_META_SQL_UPSERT), {
            "sku": sku, "team_code": team_code, "group_code": group_code,
            "group_name": group_name, "is_domestic": is_domestic,
            "group_tag": group_tag, "team_id": team_id,
        })
        # คืน id เป็น text ถ้ามี
        r = await conn.execute(sa.text("SELECT item_id FROM items WHERE sku=:sku LIMIT 1"), {"sku": sku})
        row = r.first()
        pid = str(row[0]) if row and row[0] is not None else None

    return {"ok": True, "id": pid}

@router.get(f"{API_PREFIX}/products/get")
async def products_get(
    sku: str,
    user = Depends(_auth_via_me)    # ต้อง auth ให้สอดคล้องกับหน้าเดิม
):
    if not _engine:
        raise HTTPException(status_code=503, detail="DATABASE_URL not set")
    sql = sa.text("""
      SELECT sku, name, unit, team_code, group_code, group_name, is_domestic, group_tag
      FROM v_products_full
      WHERE sku = :sku
      LIMIT 1
    """)
    async with _engine.connect() as conn:
        row = (await conn.execute(sql, {"sku": sku})).first()
    if not row:
        return {"item": None}
    return {"item": {
        "sku": row[0], "name": row[1], "unit": row[2],
        "team_code": row[3], "group_code": row[4], "group_name": row[5],
        "is_domestic": row[6], "group_tag": row[7]
    }}

@router.get(f"{API_PREFIX}/products/list")
async def products_list(
    q: Optional[str] = None,
    sort: Optional[str] = None,
    order: Optional[str] = None,
    team_code: Optional[str] = None,
    group_code: Optional[str] = None,
    origin: Optional[str] = None,      # domestic|foreign|unassigned
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=200),
    limit: Optional[int] = None,
    offset: Optional[int] = None,
    user = Depends(_auth_via_me)
):
    if not _engine:
        raise HTTPException(status_code=503, detail="DATABASE_URL not set")

    # รองรับทั้ง page/per_page และ limit/offset
    if limit is None:  limit = per_page
    if offset is None: offset = (page - 1) * per_page
    limit = max(1, min(int(limit), 200))
    offset = max(0, int(offset))

    conds = []
    params = {"limit": limit, "offset": offset}
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
    sortcol = "sku"
    if (sort or "").lower() in {"sku","name","team_code","group_code"}:
        sortcol = sort
    ordkw = "ASC" if (order or "").lower() != "desc" else "DESC"

    sql = sa.text(f"""
      SELECT sku, name, unit, team_code, group_code, group_name, is_domestic, group_tag
      FROM v_products_full
      {where}
      ORDER BY {sortcol} {ordkw}
      LIMIT :limit OFFSET :offset
    """)
    sql_count = sa.text(f"SELECT COUNT(*) FROM v_products_full {where}")
    async with _engine.connect() as conn:
        total = (await conn.execute(sql_count, params)).scalar_one()
        rows  = (await conn.execute(sql, params)).all()

    items = [{
        "sku": r[0], "name": r[1], "unit": r[2],
        "team_code": r[3], "group_code": r[4], "group_name": r[5],
        "is_domestic": r[6], "group_tag": r[7]
    } for r in rows]
    return {"items": items, "total": total}

@router.get(f"{API_PREFIX}/products/teams")
async def products_teams(user = Depends(_auth_via_me)):
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

@router.get(f"{API_PREFIX}/products/groups")
async def products_groups(user = Depends(_auth_via_me)):
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
