# FILE: backend/app/routers/products.py
from __future__ import annotations

import csv
import io
from decimal import Decimal, InvalidOperation
from typing import List, Literal, Optional
from uuid import UUID

import sqlalchemy as sa
from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    UploadFile,
    status,
    Header,
)
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from ..deps import get_db, require_perm as RP, require_user
from ..models import AuditLog
from ..models import Product as ProductModel

router = APIRouter()  # prefix from main.py => /api/products

# ===== Schemas =====
class ProductIn(BaseModel):
    sku: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1)
    unit: str = Field(..., min_length=1)
    price_ex_vat: Decimal
    cas_no: Optional[str] = None
    team_id: Optional[UUID] = None


class ProductOut(ProductIn):
    id: UUID


class ProductListOut(BaseModel):
    items: List[ProductOut]
    total: int
    page: int
    per_page: int
    pages: int


# ===== Helpers =====
def _to_out(obj: ProductModel) -> ProductOut:
    return ProductOut(
        id=obj.id,
        sku=obj.sku,
        name=obj.name,
        unit=obj.unit,
        price_ex_vat=obj.price_ex_vat,
        cas_no=getattr(obj, "cas_no", None),
        team_id=getattr(obj, "team_id", None),
    )


def _filters(q: Optional[str], team_id: Optional[UUID]):
    conds = []
    if team_id:
        conds.append(ProductModel.team_id == team_id)
    if q:
        pattern = f"%{q.strip()}%"
        conds.append(
            sa.or_(
                ProductModel.sku.ilike(pattern),
                ProductModel.name.ilike(pattern),
                ProductModel.unit.ilike(pattern),
                ProductModel.cas_no.ilike(pattern),
            )
        )
    return conds


async def _log(
    db: AsyncSession,
    user_id: Optional[UUID],
    action: str,
    subject_id: Optional[UUID] = None,
    detail: Optional[dict] = None,
):
    try:
        db.add(
            AuditLog(
                actor_id=user_id, action=action, subject_id=subject_id, detail=detail or {}
            )
        )
        await db.commit()
    except Exception:
        await db.rollback()


# ===== CRUD (ของเดิม) =====
@router.get("/", response_model=ProductListOut)
async def list_products(
    db: AsyncSession = Depends(get_db),
    user=Depends(RP("products:read")),
    q: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=100),
    sort: str = Query("sku", pattern="^(sku|name|unit|price_ex_vat)$"),
    order: str = Query("asc", pattern="^(asc|desc)$"),
    team_id: Optional[UUID] = Query(None),
):
    sort_map = {
        "sku": ProductModel.sku,
        "name": ProductModel.name,
        "unit": ProductModel.unit,
        "price_ex_vat": ProductModel.price_ex_vat,
    }
    order_by = sort_map[sort].asc() if order == "asc" else sort_map[sort].desc()
    filters = _filters(q, team_id)
    count_stmt = sa.select(sa.func.count()).select_from(ProductModel)
    if filters:
        count_stmt = count_stmt.where(sa.and_(*filters))
    total = int(await db.scalar(count_stmt) or 0)
    stmt = sa.select(ProductModel).order_by(order_by).offset(
        (page - 1) * per_page
    ).limit(per_page)
    if filters:
        stmt = stmt.where(sa.and_(*filters))
    rows = (await db.execute(stmt)).scalars().all()
    items = [_to_out(r) for r in rows]
    pages = (total + per_page - 1) // per_page if per_page else 1
    return ProductListOut(items=items, total=total, page=page, per_page=per_page, pages=pages)


# ===== Compatibility endpoints for frontend =====
@router.get("/get", response_model=ProductOut, dependencies=[Depends(RP("products:read"))])
async def get_product_by_sku(
    sku: str = Query(..., min_length=1),
    team_id: Optional[UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    stmt = sa.select(ProductModel).where(ProductModel.sku == sku)
    if team_id:
        stmt = stmt.where(ProductModel.team_id == team_id)
    obj = await db.scalar(stmt)
    if not obj:
        raise HTTPException(status_code=404, detail="Not found")
    return _to_out(obj)


class ProductUpsertIn(BaseModel):
    sku: str = Field(..., min_length=1)
    name: Optional[str] = None
    unit: Optional[str] = None
    price_ex_vat: Optional[Decimal] = None
    cas_no: Optional[str] = None
    team_id: Optional[UUID] = None


@router.post("/upsert", response_model=ProductOut)
async def upsert_product_compat(
    p: ProductUpsertIn,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_user),  # ✅ Bearer JWT หรือ session cookie ได้ทั้งคู่
    x_team_id: Optional[str] = Header(None, alias="X-Team-Id"),
):
    sku = (p.sku or "").strip()
    if not sku:
        raise HTTPException(422, detail="sku is required")

    existing = await db.scalar(sa.select(ProductModel).where(ProductModel.sku == sku))

    name = (p.name or "").strip() or sku
    unit = (p.unit or "").strip() or "EA"
    try:
        price = (
            Decimal(str(p.price_ex_vat))
            if p.price_ex_vat is not None
            else Decimal("0")
        )
    except (InvalidOperation, ValueError):
        raise HTTPException(422, detail="price_ex_vat must be a number")
    cas_no = (p.cas_no or "").strip() or None

    team_id: Optional[UUID] = p.team_id
    if team_id is None and x_team_id:
        try:
            team_id = UUID(x_team_id)
        except Exception:
            team_id = None

    if existing:
        vals = {"name": name, "unit": unit, "price_ex_vat": price, "cas_no": cas_no}
        await db.execute(
            sa.update(ProductModel).where(ProductModel.id == existing.id).values(**vals)
        )
        await db.commit()
        obj = await db.get(ProductModel, existing.id)
        await _log(
            db,
            getattr(user, "id", None),
            "product.upsert.update",
            obj.id,
            {"sku": obj.sku},
        )
        return _to_out(obj)
    else:
        if not team_id:
            raise HTTPException(
                400, detail="team_id required (provide in body or X-Team-Id header)"
            )
        obj = ProductModel(
            sku=sku,
            name=name,
            unit=unit,
            price_ex_vat=price,
            cas_no=cas_no,
            team_id=team_id,
        )
        db.add(obj)
        await db.commit()
        await db.refresh(obj)
        await _log(
            db,
            getattr(user, "id", None),
            "product.upsert.insert",
            obj.id,
            {"sku": obj.sku},
        )
        return _to_out(obj)

