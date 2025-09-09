from __future__ import annotations
from pydantic import BaseModel, Field, condecimal

class ReceiveIn(BaseModel):
    sku: str = Field(..., examples=["SKU-001"])
    wh: str = Field(..., description="warehouse code", examples=["WH-A"])
    qty: condecimal(gt=0)
    unit_cost: condecimal(ge=0)
    ref: str = Field(..., examples=["GR-2025-0001"])
    lot: str | None = Field(default=None, examples=["BATCH-01"])

class ReceiveOut(BaseModel):
    method: str
    move_id: int | None = None
    new_avg: float | None = None
    message: str = "ok"

class IssueIn(BaseModel):
    sku: str
    wh: str
    qty: condecimal(gt=0)
    ref: str = Field(..., examples=["SO-2025-0001"])

class IssueOut(BaseModel):
    method: str
    cost_used: float
    message: str = "ok"

class StockBalanceRow(BaseModel):
    sku: str
    wh: str
    onhand: float

class StockValuationRow(BaseModel):
    sku: str
    wh: str
    onhand: float
    stock_value: float
