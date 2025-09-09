# FILE: backend/app/routers/sales.py
from __future__ import annotations
import re
import sqlalchemy as sa
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
from uuid import UUID
from datetime import datetime
import zoneinfo
from sqlalchemy.ext.asyncio import AsyncSession

from ..deps import get_db, require_perm as RP
from ..models import Product as ProductModel

router = APIRouter(prefix="/sales", tags=["sales"])

TEAM_RE = re.compile(r"^[A-Z]{2,12}$")
COMP_RE = re.compile(r"^[A-Z0-9]{2,8}$")

class SOItemIn(BaseModel):
    product_id: UUID
    qty: float = Field(gt=0)
    price_ex_vat: float = Field(ge=0)

class SOCreateIn(BaseModel):
    customer: str
    notes: Optional[str] = None
    items: List[SOItemIn] = []
    team_code: Optional[str] = None
    company_code: Optional[str] = None

def _th_period():
    tz = zoneinfo.ZoneInfo("Asia/Bangkok")
    now = datetime.now(tz)
    mm = f"{now.month:02d}"
    yyyymm = f"{now.year:04d}{mm}"
    yy_th = (now.year + 543) % 100
    return mm, yyyymm, yy_th

async def _resolve_team_code(db: AsyncSession, user, override: Optional[str]) -> str:
    if override:
        t = override.strip().upper()
        if not TEAM_RE.match(t): raise HTTPException(400, "team_code ไม่ถูกต้อง (A-Z 2–12)")
        return t
    team = await db.scalar(sa.text("SELECT team_code FROM team_codes WHERE user_id=:u"), {"u": str(user.id)})
    if not team: raise HTTPException(400, "ไม่พบ team_code ของผู้ใช้ (ตั้งค่า team_codes ก่อน)")
    return team

async def _resolve_company_code(db: AsyncSession, user, override: Optional[str]) -> str:
    if override:
        c = override.strip().upper()
        if not COMP_RE.match(c): raise HTTPException(400, "company_code ไม่ถูกต้อง (A-Z0-9 2–8)")
        return c
    company = await db.scalar(sa.text("SELECT company_code FROM company_codes WHERE user_id=:u"), {"u": str(user.id)})
    return company or "SVS"

async def _next_so_number(db: AsyncSession, company_code: str, team_code: str) -> str:
    mm, period_yyyymm, yy_th = _th_period()
    key = f"so|{company_code}|{team_code}|{period_yyyymm}"
    await db.execute(sa.text("SELECT pg_advisory_xact_lock(hashtext(:k))"), {"k": key})

    res = await db.execute(sa.text("""
        INSERT INTO so_numbering(company_code, team_code, period_yyyymm, last_seq)
        VALUES (:c,:t,:p,1)
        ON CONFLICT (company_code, team_code, period_yyyymm)
        DO UPDATE SET last_seq = so_numbering.last_seq + 1
        RETURNING last_seq
    """), {"c": company_code, "t": team_code, "p": period_yyyymm})
    seq = int(res.scalar_one())
    return f"SO{team_code}{yy_th:02d}{mm}{seq:03d}"

@router.post("", dependencies=[Depends(RP("so:create"))])
async def create_so(
    payload: SOCreateIn,
    db: AsyncSession = Depends(get_db),
    user = Depends(RP("so:create")),
):
    team_code = await _resolve_team_code(db, user, payload.team_code)
    company_code = await _resolve_company_code(db, user, payload.company_code)
    number = await _next_so_number(db, company_code, team_code)

    await db.execute(sa.text("""
        INSERT INTO sales_orders(number,customer,status,notes)
        VALUES (:n,:c,'confirmed',:no)
    """), {"n": number, "c": payload.customer, "no": payload.notes})
    so_id = await db.scalar(sa.text("SELECT id FROM sales_orders WHERE number=:n"), {"n": number})

    for it in payload.items:
        prod = await db.get(ProductModel, it.product_id)
        if not prod: raise HTTPException(400, f"product {it.product_id} not found")
        await db.execute(sa.text("""
            INSERT INTO sales_order_items(so_id,product_id,sku,name,qty,price_ex_vat)
            VALUES (:so,:pid,:sku,:name,:qty,:price)
        """), {"so": so_id, "pid": it.product_id, "sku": prod.sku, "name": prod.name, "qty": it.qty, "price": it.price_ex_vat})
    await db.commit()
    return {"id": str(so_id), "number": number, "status": "confirmed"}

@router.post("/{so_id}/fulfill", dependencies=[Depends(RP("so:fulfill"))])
async def fulfill_so(so_id: UUID, db: AsyncSession = Depends(get_db), note: str = "SO fulfill"):
    h = await db.execute(sa.text("SELECT * FROM sales_orders WHERE id=:id"), {"id": so_id})
    head = h.mappings().first()
    if not head: raise HTTPException(404, "not found")
    if head["status"] == "fulfilled":
        return {"ok": True, "status": head["status"], "stock_moves": []}

    its = await db.execute(sa.text("SELECT sku, name, qty FROM sales_order_items WHERE so_id=:id"), {"id": so_id})
    items = [dict(r) for r in its.mappings().all()]
    await db.execute(sa.text("UPDATE sales_orders SET status='fulfilled' WHERE id=:id"), {"id": so_id})
    await db.commit()

    moves = [{"sku": it["sku"], "qty": -float(it["qty"]), "note": f"{head['number']} - {note}"} for it in items]
    return {"ok": True, "status": "fulfilled", "stock_moves": moves}
# ====== LIST/DETAIL (ใหม่) ======
@router.get("", dependencies=[Depends(RP("so:read"))])
async def list_sos(
    db: AsyncSession = Depends(get_db),
    q: Optional[str] = None,
    page: int = 1,
    per_page: int = 20,
):
    where = "WHERE (customer ILIKE :qq OR number ILIKE :qq)" if q else ""
    params = ({"qq": f"%{q}%"} if q else {}) | {"off": (page-1)*per_page, "lim": per_page}

    total = await db.scalar(sa.text(f"SELECT COUNT(*) FROM sales_orders {where}"), {"qq": f"%{q}%"} if q else {})
    rows = await db.execute(sa.text(f"""
        SELECT id, number, customer, status, created_at
        FROM sales_orders
        {where}
        ORDER BY created_at DESC
        OFFSET :off LIMIT :lim
    """), params)
    return {
        "items": [dict(r) for r in rows.mappings().all()],
        "total": int(total or 0), "page": page, "per_page": per_page
    }

@router.get("/{so_id}", dependencies=[Depends(RP("so:read"))])
async def get_so(so_id: UUID, db: AsyncSession = Depends(get_db)):
    h = await db.execute(sa.text("SELECT * FROM sales_orders WHERE id=:id"), {"id": so_id})
    head = h.mappings().first()
    if not head:
        raise HTTPException(404, "not found")
    its = await db.execute(sa.text("""
        SELECT product_id, sku, name, qty, price_ex_vat
        FROM sales_order_items WHERE so_id=:id
    """), {"id": so_id})
    return {"header": head, "items": [dict(r) for r in its.mappings().all()]}

