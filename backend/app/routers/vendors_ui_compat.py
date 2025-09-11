from __future__ import annotations
import sqlalchemy as sa
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.runtime import engine as _engine, resolve_current_user as _resolve_current_user, roles_of as _roles_of

router = APIRouter()

# ---------- DDL (idempotent) ----------
async def _ensure_tables():
    if not _engine:
        raise HTTPException(status_code=503, detail="DATABASE_URL not set")
    ddls = [
        """
        CREATE TABLE IF NOT EXISTS vendors (
          code        TEXT PRIMARY KEY,
          name        TEXT NOT NULL,
          created_at  TIMESTAMPTZ DEFAULT now(),
          updated_at  TIMESTAMPTZ DEFAULT now()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS vendors_meta (
          code        TEXT PRIMARY KEY REFERENCES vendors(code) ON DELETE CASCADE,
          team_code   TEXT,
          group_code  TEXT,
          group_name  TEXT,
          is_active   BOOLEAN DEFAULT TRUE
        )
        """,
        "CREATE INDEX IF NOT EXISTS idx_vendors_name ON vendors (name)"
    ]
    async with _engine.begin() as conn:
        for sql in ddls:
            await conn.execute(sa.text(sql))

# ---------- Schemas ----------
class UpsertVendorBody(BaseModel):
    code: str
    name: str
    team_code: Optional[str] = None
    group_code: Optional[str] = None
    group_name: Optional[str] = None
    is_active: Optional[bool] = True

class ToggleBody(BaseModel):
    code: str
    is_active: bool

# ---------- Endpoints ----------
@router.post("/vendors/upsert")
async def vendors_upsert(body: UpsertVendorBody, user=Depends(_resolve_current_user)):
    if not (_roles_of(user) & {"admin", "superadmin"}):
        raise HTTPException(status_code=403, detail="forbidden")
    await _ensure_tables()
    async with _engine.begin() as conn:
        await conn.execute(sa.text("""
            INSERT INTO vendors (code, name)
            VALUES (:code, :name)
            ON CONFLICT (code) DO UPDATE
            SET name = EXCLUDED.name, updated_at = now()
        """), body.dict())
        await conn.execute(sa.text("""
            INSERT INTO vendors_meta (code, team_code, group_code, group_name, is_active)
            VALUES (:code, :team_code, :group_code, :group_name, COALESCE(:is_active, TRUE))
            ON CONFLICT (code) DO UPDATE
            SET team_code  = EXCLUDED.team_code,
                group_code = EXCLUDED.group_code,
                group_name = EXCLUDED.group_name,
                is_active  = COALESCE(EXCLUDED.is_active, vendors_meta.is_active)
        """), body.dict())
    return {"ok": True, "code": body.code}

@router.get("/vendors/get")
async def vendors_get(code: str):
    await _ensure_tables()
    sql = sa.text("""
        SELECT m.code, m.name,
               x.team_code, x.group_code, x.group_name, x.is_active
        FROM vendors m
        LEFT JOIN vendors_meta x ON x.code = m.code
        WHERE m.code = :code
        LIMIT 1
    """)
    async with _engine.connect() as conn:
        row = (await conn.execute(sql, {"code": code})).first()
    if not row:
        return {"item": None}
    return {"item": {
        "code": row[0], "name": row[1],
        "team_code": row[2], "group_code": row[3], "group_name": row[4],
        "is_active": bool(row[5]) if row[5] is not None else True
    }}

@router.get("/vendors/list")
async def vendors_list(
    q: Optional[str] = None,
    team_code: Optional[str] = None,
    group_code: Optional[str] = None,
    is_active: Optional[bool] = None,
    limit: int = 20,
    offset: int = 0,
):
    await _ensure_tables()
    limit = max(1, min(limit, 200))
    offset = max(0, offset)
    conds = []
    params = {"limit": limit, "offset": offset}

    if q:
        conds.append("(m.code ILIKE :q OR m.name ILIKE :q)")
        params["q"] = f"%{q}%"
    if team_code:
        conds.append("x.team_code = :team_code")
        params["team_code"] = team_code
    if group_code:
        conds.append("x.group_code = :group_code")
        params["group_code"] = group_code
    if is_active is not None:
        conds.append("COALESCE(x.is_active, TRUE) = :is_active")
        params["is_active"] = is_active

    where = "WHERE " + " AND ".join(conds) if conds else ""
    sql = sa.text(f"""
        SELECT m.code, m.name,
               x.team_code, x.group_code, x.group_name, x.is_active
        FROM vendors m
        LEFT JOIN vendors_meta x ON x.code = m.code
        {where}
        ORDER BY m.code
        LIMIT :limit OFFSET :offset
    """)
    sql_count = sa.text(f"""
        SELECT COUNT(*) FROM vendors m
        LEFT JOIN vendors_meta x ON x.code = m.code
        {where}
    """)
    async with _engine.connect() as conn:
        total = (await conn.execute(sql_count, params)).scalar_one()
        rows  = (await conn.execute(sql, params)).all()

    items = [{
        "code": r[0], "name": r[1],
        "team_code": r[2], "group_code": r[3], "group_name": r[4],
        "is_active": bool(r[5]) if r[5] is not None else True
    } for r in rows]
    return {"items": items, "total": total}

@router.post("/vendors/active")
async def vendors_toggle_active(body: ToggleBody, user=Depends(_resolve_current_user)):
    if not (_roles_of(user) & {"admin", "superadmin"}):
        raise HTTPException(status_code=403, detail="forbidden")
    await _ensure_tables()
    async with _engine.begin() as conn:
        await conn.execute(sa.text("""
            INSERT INTO vendors (code, name) VALUES (:code, :name)
            ON CONFLICT (code) DO NOTHING
        """), {"code": body.code, "name": body.code})
        await conn.execute(sa.text("""
            INSERT INTO vendors_meta (code, is_active) VALUES (:code, :v)
            ON CONFLICT (code) DO UPDATE SET is_active = EXCLUDED.is_active
        """), {"code": body.code, "v": body.is_active})
    return {"ok": True}
