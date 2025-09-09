from fastapi import APIRouter, Query
from pydantic import BaseModel
from typing import Optional, List
import os
import sqlalchemy as sa
from sqlalchemy.ext.asyncio import create_async_engine

router = APIRouter(tags=["stock"])

DATABASE_URL = os.getenv("DATABASE_URL")
_engine = create_async_engine(DATABASE_URL, echo=False, pool_pre_ping=True) if DATABASE_URL else None

class StockCardRow(BaseModel):
    moved_at: str
    move_type: str
    sku: str
    wh: Optional[str] = None
    qty: float
    unit_cost: Optional[float] = None
    ref: Optional[str] = None
    note: Optional[str] = None

class StockCardResp(BaseModel):
    items: List[StockCardRow]

@router.get("/stock/card", response_model=StockCardResp)
async def stock_card(
    sku: str,
    wh: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    limit: int = 200,
):
    if _engine is None:
        return {"items": []}

    conds = ["i.sku = :sku"]
    params = {"sku": sku, "limit": limit}

    if wh:
        conds.append("w.wh_code = :wh")
        params["wh"] = wh
    if date_from:
        conds.append("m.moved_at >= :df")
        params["df"] = f"{date_from} 00:00:00"
    if date_to:
        conds.append("m.moved_at <= :dt")
        params["dt"] = f"{date_to} 23:59:59"

    where = "WHERE " + " AND ".join(conds)
    sql = sa.text(f"""
      SELECT
        to_char(m.moved_at, 'YYYY-MM-DD HH24:MI:SS') AS moved_at,
        m.move_type,
        i.sku,
        w.wh_code AS wh,
        COALESCE(m.qty,0) AS qty,
        m.unit_cost,
        m.ref_no AS ref,
        m.note
      FROM stock_moves m
      JOIN items i ON i.item_id = m.item_id
      LEFT JOIN warehouses w ON w.wh_id = m.wh_id
      {where}
      ORDER BY m.moved_at ASC
      LIMIT :limit
    """)

    async with _engine.connect() as conn:
        res = await conn.execute(sql, params)
        rows = res.all()

    items = [
        StockCardRow(
            moved_at=r[0], move_type=r[1], sku=r[2], wh=r[3],
            qty=float(r[4] or 0),
            unit_cost=(float(r[5]) if r[5] is not None else None),
            ref=r[6], note=r[7]
        ) for r in rows
    ]
    return StockCardResp(items=items)
