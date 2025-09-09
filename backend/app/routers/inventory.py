# FILE: backend/app/routers/inventory.py
from __future__ import annotations

from typing import Optional
import sqlalchemy as sa
from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ..schemas.inventory import ReceiveIn, ReceiveOut, IssueIn, IssueOut
from ..services.inventory_service import receive as svc_receive, issue as svc_issue
from ..deps import get_db

router = APIRouter(prefix="/inventory", tags=["inventory"])

@router.post("/receive", response_model=ReceiveOut, summary="Receive Stock")
async def receive_stock(payload: ReceiveIn):
    try:
        result = await svc_receive(
            sku=payload.sku,
            wh=payload.wh,
            qty=float(payload.qty),
            unit_cost=float(payload.unit_cost),
            ref=payload.ref,
            lot=payload.lot,
        )
        return ReceiveOut(**result)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/issue", response_model=IssueOut, summary="Issue Stock")
async def issue_stock(payload: IssueIn):
    try:
        result = await svc_issue(
            sku=payload.sku,
            wh=payload.wh,
            qty=float(payload.qty),
            ref=payload.ref,
        )
        return IssueOut(**result)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# --- Levels summary (JOIN กับ items เพราะ stock_levels.item_id -> items.item_id) ---
@router.get("/levels", summary="List stock levels by SKU")
async def list_levels(
    db: AsyncSession = Depends(get_db),
    sku: Optional[str] = Query(None, description="Filter by SKU (exact or ILIKE)"),
    limit: int = Query(100, ge=1, le=1000),
):
    """
    รวมยอด on_hand/reserved ต่อ SKU จากตาราง stock_levels
    - ถ้าไม่ส่ง sku -> คืน top N ตามตัวอักษร
    - ถ้าส่ง sku (ไม่มี wildcard) -> เทียบตรง = :q
      ถ้าส่งพร้อม wildcard (% _) -> ILIKE :q
    """
    params = {"lim": limit}
    where = ""
    if sku:
        if "%" in sku or "_" in sku:
            where = "WHERE i.sku ILIKE :q"
            params["q"] = sku
        else:
            where = "WHERE i.sku = :q"
            params["q"] = sku

    stmt = sa.text(f"""
        SELECT i.sku,
               COALESCE(SUM(s.on_hand),0)  AS on_hand,
               COALESCE(SUM(s.reserved),0) AS reserved
        FROM stock_levels s
        JOIN items i ON i.item_id = s.item_id
        {where}
        GROUP BY i.sku
        ORDER BY i.sku
        LIMIT :lim
    """)

    rows = await db.execute(stmt, params)
    return [dict(r) for r in rows.mappings().all()]

