from fastapi import APIRouter, Query
router = APIRouter()

@router.get("/customers")
async def customers(q: str = "", page: int = 1, per_page: int = 10):
    return []

@router.get("/sales/quotations")
async def quotations(page: int = 1, per_page: int = 10, q: str = ""):
    return {"items": [], "total": 0, "page": page, "per_page": per_page}

@router.get("/sales-orders")
async def sales_orders(page: int = 1, per_page: int = 10):
    return {"items": [], "total": 0, "page": page, "per_page": per_page}

@router.get("/sales/quotations/sales-reps")
async def sales_reps():
    return []

@router.get("/reports")
async def reports_root():
    return {"ok": True}
