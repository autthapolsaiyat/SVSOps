# backend/routes/dashboard.py
from fastapi import APIRouter
import os, psycopg2
from psycopg2.extras import RealDictCursor

router = APIRouter()

def get_conn():
    url = os.getenv("DATABASE_URL_DOCKER") or os.getenv("DATABASE_URL")
    return psycopg2.connect(url, cursor_factory=RealDictCursor)

@router.get("/summary")
def summary():
    """สรุปตัวเลขสำหรับแดชบอร์ด (มี fallback เป็น 0 ถ้าตารางยังไม่มี)"""
    so_open = 0
    iv_issued = 0
    stock_sku = 0
    try:
        with get_conn() as conn, conn.cursor() as cur:
            # ถ้ามีตาราง sales_orders และคอลัมน์ status
            try:
                cur.execute("SELECT COUNT(*) AS c FROM sales_orders WHERE status IN ('open','pending');")
                so_open = int(cur.fetchone()["c"])
            except Exception:
                pass

            # ถ้ามี invoices
            try:
                cur.execute("SELECT COUNT(*) AS c FROM invoices;")
                iv_issued = int(cur.fetchone()["c"])
            except Exception:
                pass

            # ถ้ามี products
            try:
                cur.execute("SELECT COUNT(*) AS c FROM products;")
                stock_sku = int(cur.fetchone()["c"])
            except Exception:
                pass
    except Exception:
        # ถ้า DB ยังไม่พร้อม ให้ส่งค่าเริ่มต้น
        pass

    return {"soOpen": so_open, "ivIssued": iv_issued, "stockSku": stock_sku}

