# FILE: backend/app/routers/dashboard.py
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional
import zoneinfo

import sqlalchemy as sa
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ..deps import get_db, require_perm as RP
from ..models import Product as ProductModel

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary")
async def summary(
    db: AsyncSession = Depends(get_db),
    user=Depends(RP("products:read")),
    days: int = Query(7, ge=1, le=365),
):
    """
    ภาพรวม: จำนวนสินค้า, มูลค่าสินค้า, สินค้าใหม่, Top5, เอกสารเดือนนี้ (Q/PO/SO),
    และเลขใบเสนอราคาล่าสุดของทีมผู้ใช้ในเดือนนี้ (ถ้ามี mapping)
    """
    # ===== สินค้า =====
    total_products = int(
        await db.scalar(sa.select(sa.func.count()).select_from(ProductModel)) or 0
    )

    total_value = await db.scalar(
        sa.select(sa.func.coalesce(sa.func.sum(ProductModel.price_ex_vat), 0))
    )
    try:
        total_value = float(total_value or 0)
    except Exception:
        total_value = 0.0

    new_since = datetime.now(timezone.utc) - timedelta(days=days)
    created_col = getattr(ProductModel, "created_at", None)
    if created_col is not None:
        new_products = int(
            await db.scalar(
                sa.select(sa.func.count())
                .select_from(ProductModel)
                .where(created_col >= new_since)
            )
            or 0
        )
    else:
        new_products = 0

    top_rows = (
        await db.execute(
            sa.select(ProductModel).order_by(ProductModel.price_ex_vat.desc()).limit(5)
        )
    ).scalars().all()
    top5 = [
        {"sku": r.sku, "name": r.name, "unit": r.unit, "price_ex_vat": str(r.price_ex_vat)}
        for r in top_rows
    ]

    # ===== เอกสารเดือนนี้ & เลขล่าสุดทีมผู้ใช้ =====
    tz = zoneinfo.ZoneInfo("Asia/Bangkok")
    now = datetime.now(tz)
    mm = f"{now.month:02d}"
    yyyymm = f"{now.year:04d}{mm}"
    yy_th = (now.year + 543) % 100

    quotes_this_month = int(
        await db.scalar(
            sa.text("SELECT COUNT(*) FROM quotations WHERE to_char(created_at,'YYYYMM')=:p"),
            {"p": yyyymm},
        ) or 0
    )
    pos_this_month = int(
        await db.scalar(
            sa.text("SELECT COUNT(*) FROM purchase_orders WHERE to_char(created_at,'YYYYMM')=:p"),
            {"p": yyyymm},
        ) or 0
    )
    sos_this_month = int(
        await db.scalar(
            sa.text("SELECT COUNT(*) FROM sales_orders WHERE to_char(created_at,'YYYYMM')=:p"),
            {"p": yyyymm},
        ) or 0
    )

    # team/company ของ user
    try:
        team_code = await db.scalar(
            sa.text("SELECT team_code FROM team_codes WHERE user_id=:u"),
            {"u": str(user.id)},
        )
    except Exception:
        team_code = None

    try:
        company_code = await db.scalar(
            sa.text("SELECT company_code FROM company_codes WHERE user_id=:u"),
            {"u": str(user.id)},
        )
    except Exception:
        company_code = None
    company_code = company_code or "SVS"

    # เลข Q ล่าสุดของทีมผู้ใช้ในเดือนนี้
    last_quote_number: Optional[str] = None
    if team_code:
        last_seq = int(
            await db.scalar(
                sa.text("""
                    SELECT last_seq
                    FROM quote_numbering
                    WHERE company_code=:c AND team_code=:t AND period_yyyymm=:p
                """),
                {"c": company_code, "t": team_code, "p": yyyymm},
            ) or 0
        )
        if last_seq:
            last_quote_number = f"Q{team_code}{yy_th:02d}{mm}{last_seq:03d}"

    return {
        "total_products": total_products,
        "total_value_ex_vat": total_value,
        "new_products_last_days": {"days": days, "count": new_products},
        "top5_by_price": top5,
        # เพิ่มทางธุรกิจ
        "quotes_this_month": quotes_this_month,
        "pos_this_month": pos_this_month,
        "sos_this_month": sos_this_month,
        "last_quote_number": last_quote_number,
        "period_yyyymm": yyyymm,
    }


@router.get("/stock")
async def stock(
    db: AsyncSession = Depends(get_db),
    user=Depends(RP("products:read")),
    limit_top: int = Query(3, ge=1, le=20),
):
    """
    รวมยอดคงเหลือ/จอง และรายการ out-of-stock (available <= 0)
    NOTE: stock_levels.item_id → items.item_id (ไม่ใช่ products.id)
    """
    try:
        totals = await db.execute(
            sa.text(
                "SELECT COALESCE(SUM(on_hand),0) AS on_hand, COALESCE(SUM(reserved),0) AS reserved FROM stock_levels"
            )
        )
        row = totals.mappings().first() or {"on_hand": 0, "reserved": 0}
        total_on_hand = int(row["on_hand"] or 0)
        total_reserved = int(row["reserved"] or 0)
        total_available = total_on_hand - total_reserved

        top = await db.execute(
            sa.text(
                """
                SELECT i.sku, i.item_name AS name, COALESCE(SUM(s.on_hand),0) AS on_hand
                FROM stock_levels s
                JOIN items i ON i.item_id = s.item_id
                GROUP BY i.sku, i.item_name
                ORDER BY on_hand DESC
                LIMIT :limit_top
                """
            ),
            {"limit_top": limit_top},
        )
        top_by_on_hand = [dict(r) for r in top.mappings().all()]

        oos = await db.execute(
            sa.text(
                """
                SELECT i.sku, i.item_name AS name,
                       (COALESCE(SUM(s.on_hand),0) - COALESCE(SUM(s.reserved),0)) AS available
                FROM stock_levels s
                JOIN items i ON i.item_id = s.item_id
                GROUP BY i.sku, i.item_name
                HAVING (COALESCE(SUM(s.on_hand),0) - COALESCE(SUM(s.reserved),0)) <= 0
                ORDER BY available ASC, i.sku ASC
                LIMIT 50
                """
            )
        )
        out_of_stock = [dict(r) for r in oos.mappings().all()]

        return {
            "total_on_hand": total_on_hand,
            "total_reserved": total_reserved,
            "total_available": total_available,
            "top_by_on_hand": top_by_on_hand,
            "out_of_stock": out_of_stock,
            "source": "stock_levels",
        }
    except Exception as e:
        return {
            "total_on_hand": 0,
            "total_reserved": 0,
            "total_available": 0,
            "top_by_on_hand": [],
            "out_of_stock": [],
            "source": "unavailable",
            "detail": f"{type(e).__name__}: {e}",
        }
@router.get("/timeseries")
async def timeseries(
    db: AsyncSession = Depends(get_db),
    user = Depends(RP("products:read")),
    days: int = Query(30, ge=1, le=365),
):
    """
    เอกสารรายวันย้อนหลัง N วัน:
    [
      { "date":"2025-08-01", "quotes":2, "pos":1, "sos":0 },
      ...
    ]
    """
    # คำนวณช่วงวันที่ฝั่ง Python และฝังเป็น literal ที่ปลอดภัย
    tz = zoneinfo.ZoneInfo("Asia/Bangkok")
    today = datetime.now(tz).date()
    start_date = today - timedelta(days=max(1, days) - 1)
    start_iso = start_date.isoformat()  # 'YYYY-MM-DD'

    # ดึงยอดต่อวันของแต่ละเอกสาร (ใช้ literal DATE 'YYYY-MM-DD')
    q_sql = sa.text(f"""
        SELECT to_char(date(created_at), 'YYYY-MM-DD') AS d, COUNT(*) AS cnt
        FROM quotations
        WHERE created_at::date >= DATE '{start_iso}'
        GROUP BY 1 ORDER BY 1
    """)
    p_sql = sa.text(f"""
        SELECT to_char(date(created_at), 'YYYY-MM-DD') AS d, COUNT(*) AS cnt
        FROM purchase_orders
        WHERE created_at::date >= DATE '{start_iso}'
        GROUP BY 1 ORDER BY 1
    """)
    s_sql = sa.text(f"""
        SELECT to_char(date(created_at), 'YYYY-MM-DD') AS d, COUNT(*) AS cnt
        FROM sales_orders
        WHERE created_at::date >= DATE '{start_iso}'
        GROUP BY 1 ORDER BY 1
    """)

    q_rows = (await db.execute(q_sql)).mappings().all()
    p_rows = (await db.execute(p_sql)).mappings().all()
    s_rows = (await db.execute(s_sql)).mappings().all()

    q_map = {r["d"]: int(r["cnt"]) for r in q_rows}
    p_map = {r["d"]: int(r["cnt"]) for r in p_rows}
    s_map = {r["d"]: int(r["cnt"]) for r in s_rows}

    # ประกอบ series ครบทุกวัน ตั้งแต่ start → today
    out = []
    d = start_date
    while d <= today:
        key = d.isoformat()
        out.append({
            "date": key,
            "quotes": q_map.get(key, 0),
            "pos":    p_map.get(key, 0),
            "sos":    s_map.get(key, 0),
        })
        d += timedelta(days=1)

    return out

