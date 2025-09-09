# schemas/products.py (ตัวอย่าง)
from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from decimal import Decimal

class ProductBase(BaseModel):
    sku: str
    name: str
    unit: str
    price_ex_vat: Decimal
    cas_no: Optional[str] = None            # ⬅️ เพิ่ม

class ProductCreate(ProductBase):
    team_id: UUID

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    unit: Optional[str] = None
    price_ex_vat: Optional[Decimal] = None
    cas_no: Optional[str] = None            # ⬅️ เพิ่ม

class ProductOut(ProductBase):
    id: UUID
    team_id: UUID

