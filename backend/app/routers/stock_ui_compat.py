# backend/app/routers/stock_ui_compat.py
from __future__ import annotations

from fastapi import APIRouter, Query, Depends, HTTPException, Header, Request
from pydantic import BaseModel
from typing import List, Optional, Literal
from datetime import date
from uuid import UUID
from decimal import Decimal, InvalidOperation

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession

from ..deps import get_db, require_user, require_perm as RP
from ..models import Product as ProductModel, AuditLog

router = APIRouter()

# ------------------------------------------------------------
# Stub models/pages (เดิม) — คงไว้ให้ UI อื่นไม่พัง
# ------------------------------------------------------------
class Paginated(BaseModel):
    items: list
    total: int
    page: int
    page_size: int

class PartnerRef(BaseModel):
    id: str = ""
    code: str = ""
    name: str = ""

class ProductRef(BaseModel):
    id: str = ""
    sku: str = ""
    name: str = ""
    uom: str = ""

class QuotationLine(BaseModel):
    id: Optional[str] = None
    product: ProductRef
    qty: float
    price: float
    discount: Optional[float] = 0.0
    amount: Optional[float] = 0.0

class Quotation(BaseModel):
    id: str = "draft-1"
    quo_no: Optional[str] = None
    quo_date: str = date.today().isoformat()
    customer: PartnerRef = PartnerRef(name="Walk-in")
    status: Literal["DRAFT","SENT","APPROVED","REJECTED"] = "DRAFT"
    currency: Optional[str] = "THB"
    subtotal: Optional[float] = 0.0
    vat: Optional[float] = 0.0
    total: Optional[float] = 0.0
    lines: List[QuotationLine] = []

class PurchaseOrderLine(BaseModel):
    id: Optional[str] = None
    product: ProductRef
    qty: float
    price: float
    amount: Optional[float] = 0.0

class PurchaseOrder(BaseModel):
    id: str = "po-draft-1"
    po_no: Optional[str] = None
    po_date: str = date.today().isoformat()
    supplier: PartnerRef = PartnerRef(code="SUP", name="Default Supplier")
    status: Literal["DRAFT","SUBMITTED","PARTIAL","RECEIVED","CLOSED"] = "DRAFT"
    currency: Optional[str] = "THB"
    total: Optional[float] = 0.0
    lines: List[PurchaseOrderLine] = []

class GoodsReceiptLine(BaseModel):
    product: ProductRef
    qty: float
    lot: Optional[str] = None
    expiry: Optional[str] = None

class GoodsReceipt(BaseModel):
    id: str = "gr-draft-1"
    gr_no: Optional[str] = None
    gr_date: str = date.today().isoformat()
    ref_po: Optional[str] = None
    supplier: PartnerRef = PartnerRef(code="SUP", name="Default Supplier")
    status: Literal["DRAFT","POSTED"] = "DRAFT"
    lines: List[GoodsReceiptLine] = []

class SalesOrderLine(BaseModel):
    product: ProductRef
    qty: float
    price: float
    amount: Optional[float] = 0.0

class SalesOrder(BaseModel):
    id: str = "so-draft-1"
    so_no: Optional[str] = None
    so_date: str = date.today().isoformat()
    customer: PartnerRef = PartnerRef(name="Walk-in")
    status: Literal["DRAFT","CONFIRMED","DELIVERED","INVOICED"] = "DRAFT"
    total: Optional[float] = 0.0
    lines: List[SalesOrderLine] = []

class Invoice(BaseModel):
    id: str = "inv-draft-1"
    inv_no: Optional[str] = None
    inv_date: str = date.today().isoformat()
    customer: PartnerRef = PartnerRef(name="Walk-in")
    status: Literal["UNPAID","PARTIAL","PAID"] = "UNPAID"
    so_ref: Optional[str] = None
    total: Optional[float] = 0.0

@router.get("/dashboard/summary")
def dashboard_summary():
    return {
        "sales_today": 0,
        "sales_month": 0,
        "inbound_today": 0,
        "stock_value": 0,
        "low_stock_count": 0,
        "open_pos": 0,
        "open_quotes": 0,
        "open_invoices": 0,
    }

@router.get("/quotes", response_model=Paginated)
def list_quotes(q: str = "", page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=200)):
    return {"items": [], "total": 0, "page": page, "page_size": page_size}

@router.post("/quotes", response_model=Quotation)
def create_quote(body: Quotation):
    return body

@router.get("/quotes/{qid}", response_model=Quotation)
def get_quote(qid: str):
    return Quotation(id=qid)

@router.put("/quotes/{qid}", response_model=Quotation)
def update_quote(qid: str, body: Quotation):
    body.id = qid
    return body

@router.post("/quotes/{qid}/send")
def send_quote(qid: str):
    return {"ok": True}

@router.get("/purchase-orders", response_model=Paginated)
def list_pos(q: str = "", page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=200)):
    return {"items": [], "total": 0, "page": page, "page_size": page_size}

@router.post("/purchase-orders", response_model=PurchaseOrder)
def create_po(body: PurchaseOrder):
    return body

@router.get("/purchase-orders/{poid}", response_model=PurchaseOrder)
def get_po(poid: str):
    return PurchaseOrder(id=poid)

@router.put("/purchase-orders/{poid}", response_model=PurchaseOrder)
def update_po(poid: str, body: PurchaseOrder):
    body.id = poid
    return body

@router.post("/purchase-orders/{poid}/submit")
def submit_po(poid: str):
    return {"ok": True}

@router.get("/inventory/receipts", response_model=Paginated)
def list_grs(q: str = "", page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=200)):
    return {"items": [], "total": 0, "page": page, "page_size": page_size}

@router.post("/inventory/receipts", response_model=GoodsReceipt)
def create_gr(body: GoodsReceipt):
    return body

@router.post("/inventory/receipts/{grid}/post")
def post_gr(grid: str):
    return {"ok": True}

@router.get("/sales/orders")
def list_sos(
    q: str = "",
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200)
):
    return {"items": [], "total": 0, "page": page, "page_size": page_size}

@router.post("/sales/orders/{soid}/confirm")
def confirm_so(soid: str):
    return {"ok": True}

@router.post("/sales/orders/{soid}/deliver")
def deliver_so(soid: str):
    return {"ok": True}

@router.post("/sales/orders/{soid}/invoice", response_model=Invoice)
def invoice_so(soid: str):
    return Invoice(so_ref=soid)

@router.get("/billing/invoices", response_model=Paginated)
def list_invoices(q: str = "", page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=200)):
    return {"items": [], "total": 0, "page": page, "page_size": page_size}

@router.post("/billing/invoices/{invid}/pay")
def pay_invoice(invid: str, amount: float):
    return {"status": "PAID"}

# ------------------------------------------------------------
# Utils สำหรับ Product (dynamic fields)
# ------------------------------------------------------------
def _has_col(name: str) -> bool:
    return hasattr(ProductModel, name)

def _get_price_field() -> str:
    if _has_col("price_ex_vat"): return "price_ex_vat"
    if _has_col("price"):        return "price"
    return ""

def _get_unit_field() -> str:
    if _has_col("unit"): return "unit"
    if _has_col("uom"):  return "uom"
    return ""

def _get(obj, name: str, default=None):
    return getattr(obj, name, default)

def _to_decimal(v, default=Decimal("0")) -> Decimal:
    if v is None: return default
    try:
        return Decimal(str(v))
    except (InvalidOperation, ValueError):
        return default

# ------------------------------------------------------------
# Pydantic Schemas (รองรับ meta ด้วย)
# ------------------------------------------------------------
class _ProductOut(BaseModel):
    id: UUID
    sku: str
    name: str
    unit: Optional[str] = None
    price_ex_vat: Optional[Decimal] = None
    cas_no: Optional[str] = None
    team_id: Optional[UUID] = None
    # meta fields
    team_code: Optional[str] = None
    group_code: Optional[str] = None
    group_name: Optional[str] = None
    is_domestic: Optional[bool] = None
    group_tag: Optional[str] = None

    class Config:
        from_attributes = True

class _ProductUpsertIn(BaseModel):
    sku: str
    name: Optional[str] = None
    unit: Optional[str] = None
    price_ex_vat: Optional[Decimal] = None
    cas_no: Optional[str] = None
    team_id: Optional[UUID] = None
    # meta fields
    team_code: Optional[str] = None
    group_code: Optional[str] = None
    group_name: Optional[str] = None
    is_domestic: Optional[bool] = None
    group_tag: Optional[str] = None

def _to_out_dynamic(obj: ProductModel) -> _ProductOut:
    unit_field = _get_unit_field()
    price_field = _get_price_field()
    return _ProductOut(
        id=_get(obj, "id"),
        sku=_get(obj, "sku", ""),
        name=_get(obj, "name", ""),
        unit=(_get(obj, unit_field) if unit_field else None),
        price_ex_vat=(_get(obj, price_field) if price_field else None),
        cas_no=(_get(obj, "cas_no") if _has_col("cas_no") else None),
        team_id=(_get(obj, "team_id") if _has_col("team_id") else None),
    )

async def _log(db: AsyncSession, actor_id: Optional[UUID], action: str, subject_id: Optional[UUID] = None, detail: Optional[dict] = None):
    try:
        db.add(AuditLog(actor_id=actor_id, action=action, subject_id=subject_id, detail=detail or {}))
        await db.commit()
    except Exception:
        await db.rollback()

# ------------------------------------------------------------
# META helpers (AsyncSession)
# ------------------------------------------------------------
async def ensure_products_meta(db: AsyncSession):
    await db.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS products_meta (
            sku TEXT PRIMARY KEY,
            team_code TEXT,
            group_code TEXT,
            group_name TEXT,
            is_domestic BOOLEAN,
            group_tag TEXT
        )
    """))
    await db.commit()

async def upsert_products_meta(
    db: AsyncSession,
    *,
    sku: str,
    team_code: str | None = None,
    group_code: str | None = None,
    group_name: str | None = None,
    is_domestic: bool | None = None,
    group_tag: str | None = None,
):
    await ensure_products_meta(db)
    await db.execute(sa.text("""
        INSERT INTO products_meta (sku, team_code, group_code, group_name, is_domestic, group_tag)
        VALUES (:sku, :team_code, :group_code, :group_name, :is_domestic, :group_tag)
        ON CONFLICT (sku) DO UPDATE SET
            team_code   = EXCLUDED.team_code,
            group_code  = EXCLUDED.group_code,
            group_name  = EXCLUDED.group_name,
            is_domestic = EXCLUDED.is_domestic,
            group_tag   = EXCLUDED.group_tag
    """), {
        "sku": sku,
        "team_code": team_code,
        "group_code": group_code,
        "group_name": group_name,
        "is_domestic": is_domestic,
        "group_tag": group_tag,
    })
    await db.commit()

async def get_products_meta(db: AsyncSession, sku: str) -> dict:
    await ensure_products_meta(db)
    row = (await db.execute(sa.text("""
        SELECT sku, team_code, group_code, group_name, is_domestic, group_tag
        FROM products_meta WHERE sku = :sku
    """), {"sku": sku})).mappings().first()
    return dict(row) if row else {}

# ------------------------------------------------------------
# Endpoints (async) — products/get, products/upsert, products/list
# ------------------------------------------------------------
@router.get("/products/get", response_model=_ProductOut, dependencies=[Depends(RP("products:read"))])
async def products_get_by_sku(
    sku: str = Query(..., min_length=1),
    team_id: Optional[UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    stmt = sa.select(ProductModel).where(ProductModel.sku == sku)
    if team_id and _has_col("team_id"):
        stmt = stmt.where(ProductModel.team_id == team_id)
    obj = await db.scalar(stmt)
    if not obj:
        raise HTTPException(status_code=404, detail="Not found")
    out = _to_out_dynamic(obj)
    meta = await get_products_meta(db, out.sku)
    return out.model_copy(update=meta)

@router.post("/products/upsert", response_model=_ProductOut, dependencies=[Depends(require_user)])
async def products_upsert(
    p: _ProductUpsertIn,
    db: AsyncSession = Depends(get_db),
    x_team_id: Optional[str] = Header(None, alias="X-Team-Id"),
    user = Depends(require_user),
):
    sku = (p.sku or "").strip()
    if not sku:
        raise HTTPException(status_code=422, detail="sku is required")

    existing = await db.scalar(sa.select(ProductModel).where(ProductModel.sku == sku))

    name = (p.name or "").strip() or sku
    unit_in = (p.unit or "").strip() or "EA"
    price_in = _to_decimal(p.price_ex_vat, Decimal("0"))

    unit_field = _get_unit_field()
    price_field = _get_price_field()

    # team_id resolve
    team_id: Optional[UUID] = p.team_id
    if team_id is None and x_team_id:
        try:
            team_id = UUID(x_team_id)
        except Exception:
            team_id = None

    if existing:
        vals = {"name": name}
        if unit_field:  vals[unit_field]  = unit_in
        if price_field: vals[price_field] = price_in
        if _has_col("cas_no"):  vals["cas_no"]  = (p.cas_no or None)
        if _has_col("team_id") and team_id: vals["team_id"] = team_id

        await db.execute(sa.update(ProductModel).where(ProductModel.id == existing.id).values(**vals))
        await db.commit()
        obj = await db.get(ProductModel, existing.id)
        await _log(db, getattr(user, "id", None), "product.upsert.update", obj.id, {"sku": obj.sku})
    else:
        ins = {"sku": sku, "name": name}
        if unit_field:  ins[unit_field]  = unit_in
        if price_field: ins[price_field] = price_in
        if _has_col("cas_no"):  ins["cas_no"]  = (p.cas_no or None)
        if _has_col("team_id"):
            if not team_id:
                raise HTTPException(400, detail="team_id required (provide in body or X-Team-Id header)")
            ins["team_id"] = team_id

        obj = ProductModel(**ins)
        db.add(obj)
        await db.commit()
        await db.refresh(obj)
        await _log(db, getattr(user, "id", None), "product.upsert.insert", obj.id, {"sku": obj.sku})

    # upsert meta
    await upsert_products_meta(
        db,
        sku=sku,
        team_code=p.team_code,
        group_code=p.group_code,
        group_name=p.group_name,
        is_domestic=p.is_domestic,
        group_tag=p.group_tag,
    )

    out = _to_out_dynamic(obj)
    meta = await get_products_meta(db, out.sku)
    return out.model_copy(update=meta)

@router.get("/products/list", dependencies=[Depends(RP("products:read"))])
async def products_list(
    db: AsyncSession = Depends(get_db),
    q: Optional[str] = Query(None, description="ค้นหาใน sku/name/unit"),
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=100),
    team_id: Optional[UUID] = Query(None),
    team_code: Optional[str] = Query(None),
    group_code: Optional[str] = Query(None),
    origin: Optional[str] = Query(None, pattern="^(domestic|foreign|unassigned)$"),
    sort: str = Query("sku", pattern="^(sku|name|unit|price_ex_vat)$"),
    order: str = Query("asc", pattern="^(asc|desc)$"),
):
    sort_map = {
        "sku": ProductModel.sku,
        "name": ProductModel.name,
        "unit": getattr(ProductModel, _get_unit_field() or "name", ProductModel.name),
        "price_ex_vat": getattr(ProductModel, _get_price_field() or "name", ProductModel.name),
    }
    order_by = sort_map[sort].asc() if order == "asc" else sort_map[sort].desc()

    conds = []
    if team_id and _has_col("team_id"):
        conds.append(ProductModel.team_id == team_id)
    if q:
        pat = f"%{q.strip()}%"
        unit_col = getattr(ProductModel, _get_unit_field() or "name", ProductModel.name)
        conds.append(sa.or_(
            ProductModel.sku.ilike(pat),
            ProductModel.name.ilike(pat),
            unit_col.ilike(pat),
        ))

    # ดึงทั้งหมดก่อน แล้วค่อยกรองด้วย meta (ง่ายและชัวร์สำหรับตอนนี้)
    stmt_all = sa.select(ProductModel)
    if conds:
        stmt_all = stmt_all.where(sa.and_(*conds))
    stmt_all = stmt_all.order_by(order_by)
    rows_all = (await db.execute(stmt_all)).scalars().all()

    # เตรียม meta map สำหรับ sku ทั้งหมด
    skus = [r.sku for r in rows_all]
    meta_map: dict[str, dict] = {}
    if skus:
        await ensure_products_meta(db)
        # ใช้ IN query ดึง meta ทีเดียว
        meta_rows = (await db.execute(
            sa.text("""
                SELECT sku, team_code, group_code, group_name, is_domestic, group_tag
                FROM products_meta WHERE sku = ANY(:skus)
            """),
            {"skus": skus}
        )).mappings().all()
        for m in meta_rows:
            meta_map[m["sku"]] = dict(m)

    # กรองด้วย team_code / group_code / origin
    def pass_meta(m: dict) -> bool:
        if team_code and (m.get("team_code") or "") != team_code:
            return False
        if group_code and (m.get("group_code") or "") != group_code:
            return False
        if origin:
            flag = m.get("is_domestic", None)
            if origin == "domestic" and flag is not True:
                return False
            if origin == "foreign" and flag is not False:
                return False
            if origin == "unassigned" and flag is not None:
                return False
        return True

    filtered = []
    for r in rows_all:
        m = meta_map.get(r.sku, {})
        if not pass_meta(m):
            continue
        filtered.append({
            "id": str(r.id),
            "sku": r.sku,
            "name": r.name,
            "unit": getattr(r, _get_unit_field() or "unit", None),
            **{k: v for k, v in m.items() if k != "sku"},
        })

    total = len(filtered)
    start = (page - 1) * per_page
    end = start + per_page
    items = filtered[start:end]
    pages = (total + per_page - 1) // per_page if per_page else 1

    return {"items": items, "total": total, "page": page, "per_page": per_page, "pages": pages}

