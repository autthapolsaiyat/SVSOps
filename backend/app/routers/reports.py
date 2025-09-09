from __future__ import annotations
from fastapi import APIRouter, Query
from ..schemas.inventory import StockBalanceRow, StockValuationRow
from ..services.inventory_service import report_balance, report_valuation

router = APIRouter(prefix="/reports", tags=["reports"])

@router.get("/stock/balance", response_model=list[StockBalanceRow], summary="Stock On-hand (by item/wh)")
async def stock_balance():
    return await report_balance()

@router.get("/stock/valuation", response_model=list[StockValuationRow], summary="Stock Valuation (FIFO or AVG)")
async def stock_valuation(method: str = Query("fifo", pattern="^(fifo|avg|moving_avg)$", description="fifo|avg|moving_avg")):
    return await report_valuation(method)
