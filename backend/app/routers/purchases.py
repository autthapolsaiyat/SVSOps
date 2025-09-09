# FILE: backend/app/routers/purchases.py
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

router = APIRouter(prefix="/purchases", tags=["purchases"])

TEAM_RE = re.compile(r"^[A-Z]{2,12}$")
COMP_RE = re.compile(r"^[A-Z0-9]{2,8}$")


# ===== Schemas =====
class POItemIn(BaseModel):
    product_id: UUID
    qty: float = Field(gt=0)
    price_ex_vat: float = Field(ge=0)


class POCreateIn(BaseModel):
    vendor: str
    notes: Optional[str] = None
    items: List[POItemIn] = []
    team_code: Optional[str] = None       # เลือกทีมเองได้ (ถ้าไม่ใส่จะอิง user)
    company_code: Optional[str] = None    # เลือกบริษัทเองได้ (ถ้าไม่ใส่ default 'SVS')


# ===== Helpers =====
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
        if not TEAM_RE.match(t):
            raise HTTPException(status_code=400, detail="team_code ไม่ถูกต้อง (A-Z 2–12)")
        return t
    team = await db.scalar(sa.text("SELECT team_code FROM team_codes WHERE user_id=:u"), {"u": str(user.id)})
    if not team:
        raise HTTPException(status_code=400, detail="ไม่พบ team_code ของผู้ใช้ (ตั้งค่า team_codes ก่อน)")
    return team


async def _resolve_company_code(db: AsyncSession, user, override: Optional[str]) -> str:
    if override:
        c = override.strip().upper()
        if not COMP_RE.match(c):
            raise HTTPException(status_code=400, detail="company_code ไม่ถูกต้อง (A-Z0-9 2–8)")
        return c
    company = await db.scalar(sa.text("SELECT company_code FROM company_codes WHERE user_id=:u"), {"u": str(user.id)})
    return company or "SVS"


async def _next_po_number(db: AsyncSession, company_code: str, team_code: str) -> str:
    mm, period_yyyymm, yy_th = _th_period()

    # ✅ ใช้ advisory lock (int4,int4) — เข้ากันได้แน่นอน
    key = f"po|{company_code}|{team_code}|{period_yyyymm}"
    await db.execute(sa.text("SELECT pg_advisory_xact_lock(hashtext(:k), 0)"), {"k": key})

    res = await db.execute(sa.text("""
        INSERT INTO po_numbering(company_code, team_code, period_yyyymm, last_seq)
        VALUES (:c,:t,:p,1)
        ON CONFLICT (company_code, team_code, period_yyyymm)
        DO UPDATE SET last_seq = po_numbering.last_seq + 1
        RETURNING last_seq
    """), {"c": company_code, "t": team_code, "p": period_yyyymm})
    seq = int(res.scalar_one())

    # PO<TEAM><YY><MM><SEQ3>
    return f"PO{team_code}{yy_th:02d}{mm}{seq:03d}"


# ===== Routes =====
@router.post("", dependencies=[Depends(RP("po:create"))])
async def create_po(
    payload: POCreateIn,
    db: AsyncSession = Depends(get_db),
    user = Depends(RP("po:create")),
):
    if not payload.vendor or not payload.vendor.strip():
        raise HTTPException(status_code=400, detail="ต้องกรอกชื่อ Vendor")

    # 🟡 หุ้มส่วน numbering เพื่อให้เห็นรายละเอียดถ้ายังมี error
    try:
        team_code    = await _resolve_team_code(db, user, payload.team_code)
        company_code = await _resolve_company_code(db, user, payload.company_code)
        number       = await _next_po_number(db, company_code, team_code)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"numbering_error: {type(e).__name__}: {e}")

    await db.execute(sa.text("""
        INSERT INTO purchase_orders(number,vendor,status,notes)
        VALUES(:n,:v,'ordered',:no)
    """), {"n": number, "v": payload.vendor.strip(), "no": payload.notes})
    po_id = await db.scalar(sa.text("SELECT id FROM purchase_orders WHERE number=:n"), {"n": number})

    # รายการ (ถ้ามี)
    for it in payload.items:
        prod = await db.get(ProductModel, it.product_id)
        if not prod:
            raise HTTPException(status_code=400, detail=f"product {it.product_id} not found")
        await db.execute(sa.text("""
            INSERT INTO purchase_order_items(po_id,product_id,sku,name,qty,price_ex_vat)
            VALUES (:po,:pid,:sku,:name,:qty,:price)
        """), {"po": po_id, "pid": it.product_id, "sku": prod.sku, "name": prod.name,
               "qty": it.qty, "price": it.price_ex_vat})

    await db.commit()
    return {"id": str(po_id), "number": number, "status": "ordered"}


@router.post("/{po_id}/receive", dependencies=[Depends(RP("po:receive"))])
async def receive_po(po_id: UUID, db: AsyncSession = Depends(get_db), note: str = "PO receive"):
    h = await db.execute(sa.text("SELECT * FROM purchase_orders WHERE id=:id"), {"id": po_id})
    head = h.mappings().first()
    if not head:
        raise HTTPException(status_code=404, detail="not found")
    if head["status"] == "received":
        return {"ok": True, "status": head["status"], "stock_moves": []}

    its = await db.execute(sa.text("SELECT sku, name, qty FROM purchase_order_items WHERE po_id=:id"), {"id": po_id})
    items = [dict(r) for r in its.mappings().all()]

    await db.execute(sa.text("UPDATE purchase_orders SET status='received' WHERE id=:id"), {"id": po_id})
    await db.commit()

    moves = [{"sku": it["sku"], "qty": float(it["qty"]), "note": f"{head['number']} - {note}"} for it in items]
    return {"ok": True, "status": "received", "stock_moves": moves}
# ====== LIST/DETAIL (ใหม่) ======
@router.get("", dependencies=[Depends(RP("po:read"))])
async def list_pos(
    db: AsyncSession = Depends(get_db),
    q: Optional[str] = None,
    page: int = 1,
    per_page: int = 20,
):
    where = "WHERE (vendor ILIKE :qq OR number ILIKE :qq)" if q else ""
    params = ({"qq": f"%{q}%"} if q else {}) | {"off": (page-1)*per_page, "lim": per_page}

    total = await db.scalar(sa.text(f"SELECT COUNT(*) FROM purchase_orders {where}"), {"qq": f"%{q}%"} if q else {})
    rows = await db.execute(sa.text(f"""
        SELECT id, number, vendor, status, created_at
        FROM purchase_orders
        {where}
        ORDER BY created_at DESC
        OFFSET :off LIMIT :lim
    """), params)
    return {
        "items": [dict(r) for r in rows.mappings().all()],
        "total": int(total or 0), "page": page, "per_page": per_page
    }

@router.get("/{po_id}", dependencies=[Depends(RP("po:read"))])
async def get_po(po_id: UUID, db: AsyncSession = Depends(get_db)):
    h = await db.execute(sa.text("SELECT * FROM purchase_orders WHERE id=:id"), {"id": po_id})
    head = h.mappings().first()
    if not head:
        raise HTTPException(404, "not found")
    its = await db.execute(sa.text("""
        SELECT product_id, sku, name, qty, price_ex_vat
        FROM purchase_order_items WHERE po_id=:id
    """), {"id": po_id})
    return {"header": head, "items": [dict(r) for r in its.mappings().all()]}

