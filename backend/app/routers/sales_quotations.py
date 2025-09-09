from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, insert, update, delete, text, func
from uuid import UUID
from typing import Optional, List, Any, Dict
from app.db import get_db
from app.dependencies.auth import get_current_user  # ใช้ user.id
# ตารางคุณมีชื่อ "quotations" / "quotation_items" ตามเดิม
from sqlalchemy import Table, MetaData

router = APIRouter(prefix="/sales/quotations", tags=["sales-quotations"])
md = MetaData()

quotations = Table("quotations", md, autoload_with=None)       # ใช้ reflection runtime
quotation_items = Table("quotation_items", md, autoload_with=None)
team_codes = Table("team_codes", md, autoload_with=None)
company_codes = Table("company_codes", md, autoload_with=None)
sales_reps = Table("sales_reps", md, autoload_with=None)

async def reflect(md: MetaData, db: AsyncSession):
    if not quotations.metadata.bind:
        engine = db.get_bind()
        md.bind = engine
        md.reflect(only=["quotations","quotation_items","team_codes","company_codes","sales_reps"])

@router.get("", response_model=dict)
async def list_q(
    q: Optional[str] = None,
    status: Optional[str] = None,
    team_code: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    await reflect(md, db)
    stmt = select(quotations).order_by(quotations.c.created_at.desc())
    if q:
        like = f"%{q}%"
        stmt = stmt.where((quotations.c.number.ilike(like)) | (quotations.c.customer.ilike(like)))
    if status:
        stmt = stmt.where(quotations.c.status == status)
    if date_from:
        stmt = stmt.where(quotations.c.created_at >= text(":df")).params(df=date_from)
    if date_to:
        stmt = stmt.where(quotations.c.created_at < text(":dt") ).params(dt=date_to)
    if team_code:
        stmt = stmt.where(text(":tc = substring(quotations.number from 2 for 3)")).params(tc=team_code)

    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar()
    rows = (await db.execute(stmt.offset((page-1)*page_size).limit(page_size))).mappings().all()
    return {"items":[dict(r) for r in rows], "total": total, "page": page, "page_size": page_size}

@router.get("/{qid}", response_model=dict)
async def get_q(qid: UUID, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    await reflect(md, db)
    row = (await db.execute(select(quotations).where(quotations.c.id==qid))).mappings().first()
    if not row: raise HTTPException(404, "Not found")
    items = (await db.execute(select(quotation_items).where(quotation_items.c.quotation_id==qid))).mappings().all()
    out = dict(row); out["items"] = [dict(i) for i in items]
    return out

@router.post("", response_model=dict)
async def create_q(
    payload: Dict[str, Any] = Body(...),  # {customer, notes, items:[{sku,name,qty,price_ex_vat,...}]}
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    await reflect(md, db)
    # หา team/company ของ user
    tc = (await db.execute(select(team_codes.c.team_code).where(team_codes.c.user_id==user.id))).scalar()
    cc = (await db.execute(select(company_codes.c.company_code).where(company_codes.c.user_id==user.id))).scalar()
    if not tc or not cc:
        raise HTTPException(400, "team_code / company_code not mapped for user")

    # ออกเลขเอกสาร
    n_stmt = text("SELECT next_quote_number(:cc,:tc)")
    number = (await db.execute(n_stmt, {"cc": cc, "tc": tc})).scalar()
    # snapshot ผู้ขาย
    rep = (await db.execute(select(sales_reps).where(sales_reps.c.user_id==user.id))).mappings().first()

    ins = quotations.insert().values(
        number=number,
        customer=payload.get("customer",""),
        status="draft",
        notes=payload.get("notes"),
        vat_rate=payload.get("vat_rate", 0.07),  # หน่วยเดิมของคุณเป็น 0.07 = 7%
        doc_discount_rate=payload.get("doc_discount_rate"),
        doc_discount_amount=payload.get("doc_discount_amount"),
        sales_user_id=user.id,
        sales_name=(rep or {}).get("full_name"),
        sales_phone=(rep or {}).get("phone"),
        sales_email=(rep or {}).get("email"),
    ).returning(quotations.c.id, quotations.c.number)
    qrow = (await db.execute(ins)).first()
    qid = qrow.id

    # ใส่รายการ
    items = payload.get("items", [])
    for it in items:
        await db.execute(quotation_items.insert().values(
            quotation_id=qid,
            product_id=it.get("product_id"),
            sku=it["sku"],
            name=it.get("name",""),
            qty=it.get("qty",1),
            price_ex_vat=it.get("price_ex_vat",0),
            part_no=it.get("part_no"),
            description=it.get("description"),
            cas_no=it.get("cas_no"),
            package_label=it.get("package_label"),
            warn_text=it.get("warn_text"),
            discount_rate=it.get("discount_rate"),
            discount_amount=it.get("discount_amount"),
            catalog_id=it.get("catalog_id"),
        ))
    await db.commit()

    return {"id": qid, "number": qrow.number, "status": "draft"}

@router.patch("/{qid}", response_model=dict)
async def update_head(qid: UUID, payload: Dict[str, Any], db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    await reflect(md, db)
    fields = {k:v for k,v in payload.items() if k in ["customer","notes","vat_rate","doc_discount_rate","doc_discount_amount","expires_at"]}
    if not fields: return {"ok": True}
    await db.execute(quotations.update().where(quotations.c.id==qid).values(**fields))
    await db.commit()
    return {"ok": True}

@router.put("/{qid}/items", response_model=dict)
async def replace_items(qid: UUID, payload: Dict[str, Any], db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    await reflect(md, db)
    items = payload.get("items", [])
    await db.execute(delete(quotation_items).where(quotation_items.c.quotation_id==qid))
    for it in items:
        await db.execute(quotation_items.insert().values(
            quotation_id=qid,
            sku=it["sku"], name=it.get("name",""),
            qty=it.get("qty",1), price_ex_vat=it.get("price_ex_vat",0),
            part_no=it.get("part_no"), description=it.get("description"),
            cas_no=it.get("cas_no"), package_label=it.get("package_label"),
            warn_text=it.get("warn_text"), discount_rate=it.get("discount_rate"),
            discount_amount=it.get("discount_amount"), catalog_id=it.get("catalog_id"),
        ))
    await db.commit()
    return {"ok": True}

@router.post("/{qid}/items", response_model=dict)
async def add_item(qid: UUID, it: Dict[str, Any], db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    await reflect(md, db)
    await db.execute(quotation_items.insert().values(
        quotation_id=qid, sku=it["sku"], name=it.get("name",""),
        qty=it.get("qty",1), price_ex_vat=it.get("price_ex_vat",0)
    ))
    await db.commit()
    return {"ok": True}

@router.delete("/{qid}/items/{item_id}", response_model=dict)
async def del_item(qid: UUID, item_id: UUID, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    await reflect(md, db)
    await db.execute(delete(quotation_items).where(quotation_items.c.id==item_id, quotation_items.c.quotation_id==qid))
    await db.commit()
    return {"ok": True}

@router.post("/{qid}/status", response_model=dict)
async def set_status(qid: UUID, payload: Dict[str,str], db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    await reflect(md, db)
    new_status = payload.get("status")
    if new_status not in ["draft","sent","accepted","declined","cancelled","expired"]:
        raise HTTPException(400, "invalid status")
    # guard: ต้องมีรายการอย่างน้อยเมื่อ sent/accepted
    if new_status in ["sent","accepted"]:
        cnt = (await db.execute(select(func.count()).select_from(quotation_items).where(quotation_items.c.quotation_id==qid))).scalar()
        if not cnt: raise HTTPException(400, "no items")
    await db.execute(quotations.update().where(quotations.c.id==qid).values(status=new_status))
    await db.commit()
    return {"ok": True}

# หมายเหตุ: POST /{qid}/to-so จะคืน payload stock_moves ไปยัง /inventory/issue
# (จงผูกกับ service ฝั่งคุณต่อ)

