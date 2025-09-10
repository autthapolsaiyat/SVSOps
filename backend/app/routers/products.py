from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict

router = APIRouter(prefix="/products", tags=["products"])

class Product(BaseModel):
    sku: str
    name: Optional[str] = None
    unit: Optional[str] = None
    group_code: Optional[str] = None
    origin: Optional[str] = None
    price: Optional[float] = None
    note: Optional[str] = None
    status: Optional[str] = None

class Paged(BaseModel):
    items: List[Product]
    total: int
    page: int
    page_size: int

# in-memory ชั่วคราวให้หน้า FE ใช้งานได้ (เลิกใช้เมื่อเชื่อม DB จริง)
_DB: Dict[str, Product] = {}

def _page(items: List[Product], page:int, page_size:int):
    total = len(items)
    start = max(0, (page-1)*page_size)
    end = start + page_size
    return {"items": items[start:end], "total": total, "page": page, "page_size": page_size}

@router.get("", response_model=Paged)
def list_products(search: str = "", page: int = 1, page_size: int = 10, sort: str = "sku asc"):
    items = list(_DB.values())
    if search:
        q = search.lower()
        items = [p for p in items if q in (p.name or "").lower() or q in p.sku.lower()]
    return _page(items, page, page_size)

@router.get("/list", response_model=Paged)
def list_products_compat(search: str = "", page: int = 1, page_size: int = 10, sort: str = "sku asc"):
    return list_products(search=search, page=page, page_size=page_size, sort=sort)

@router.get("/get", response_model=Product)
def get_product(sku: str):
    return _DB.get(sku) or Product(sku=sku)

@router.get("/{sku}", response_model=Product)
def get_product_by_path(sku: str):
    return get_product(sku)

@router.post("", response_model=Product)
def create_or_update_product(p: Product):
    _DB[p.sku] = p
    return p

@router.post("/upsert", response_model=Product)
def upsert_product(p: Product):
    return create_or_update_product(p)

@router.put("/{sku}", response_model=Product)
def update_product(sku: str, p: Product):
    _DB[sku] = p.copy(update={"sku": sku})
    return _DB[sku]

@router.delete("/delete")
def delete_product(sku: str):
    _DB.pop(sku, None)
    return {"ok": True}

@router.delete("/{sku}")
def delete_product_by_path(sku: str):
    return delete_product(sku)
