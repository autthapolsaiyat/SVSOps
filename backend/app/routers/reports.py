from fastapi import APIRouter
router = APIRouter(prefix="/reports", tags=["reports"])

@router.get("/dashboard")
def dashboard():
    return {
        "sales_today": 0,
        "orders_today": 0,
        "quotes_today": 0,
        "stock_items": 0,
        "po_pending": 0,
        "invoice_today": 0,
        "invoice_pending": 0,
    }
