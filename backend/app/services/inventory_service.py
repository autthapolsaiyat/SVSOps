from __future__ import annotations
import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncEngine
from ..db import get_engine

SQL_COSTING = sa.text("SELECT costing_method FROM inv_config WHERE id=1")
SQL_FIFO_RECEIVE = sa.text(
    "SELECT fifo_receive_move(:sku, :wh, :qty, :unit_cost, :ref, :lot, :uid) AS move_id"
)
SQL_FIFO_ISSUE = sa.text(
    "SELECT fifo_issue_move(:sku, :wh, :qty, :ref, :uid) AS cost_used"
)
SQL_AVG_RECEIVE = sa.text(
    "SELECT avg_receive_move(:sku, :wh, :qty, :unit_cost, :ref, :lot, :uid) AS new_avg"
)
SQL_AVG_ISSUE = sa.text(
    "SELECT avg_issue_move(:sku, :wh, :qty, :ref, :uid) AS cost_used"
)

SQL_BALANCE = sa.text("""
SELECT i.sku, w.code AS wh, b.onhand_qty AS onhand
FROM v_inv_balance b
JOIN inv_items i ON i.id=b.item_id
JOIN inv_warehouses w ON w.id=b.wh_id
ORDER BY i.sku, w.code
""")

SQL_VALUATION_FIFO = sa.text("""
SELECT i.sku, w.code AS wh,
       COALESCE(SUM(l.remain_qty),0) AS onhand,
       COALESCE(SUM(l.remain_qty * l.layer_cost),0) AS stock_value
FROM inv_cost_layers l
JOIN inv_items i ON i.id = l.item_id
JOIN inv_warehouses w ON w.id = l.wh_id
GROUP BY i.sku, w.code
ORDER BY i.sku, w.code
""")

SQL_VALUATION_AVG = sa.text("""
SELECT i.sku, w.code AS wh,
       a.onhand_qty AS onhand,
       (a.onhand_qty * a.avg_cost) AS stock_value
FROM inv_avg_cost a
JOIN inv_items i ON i.id = a.item_id
JOIN inv_warehouses w ON w.id = a.wh_id
ORDER BY i.sku, w.code
""")

async def get_method(engine: AsyncEngine | None = None) -> str:
    engine = engine or get_engine()
    async with engine.connect() as conn:
        r = await conn.execute(SQL_COSTING)
        row = r.first()
        return (row[0] if row and row[0] else "FIFO").upper()

async def receive(sku: str, wh: str, qty: float, unit_cost: float, ref: str, lot: str | None, user_id: int = 1,
                  engine: AsyncEngine | None = None):
    engine = engine or get_engine()
    method = await get_method(engine)
    async with engine.begin() as conn:
        if method == "MOVING_AVG":
            r = await conn.execute(SQL_AVG_RECEIVE, dict(sku=sku, wh=wh, qty=qty, unit_cost=unit_cost, ref=ref, lot=lot, uid=user_id))
            new_avg = float(r.scalar())
            return dict(method=method, move_id=None, new_avg=new_avg)
        else:
            r = await conn.execute(SQL_FIFO_RECEIVE, dict(sku=sku, wh=wh, qty=qty, unit_cost=unit_cost, ref=ref, lot=lot, uid=user_id))
            move_id = int(r.scalar())
            return dict(method=method, move_id=move_id, new_avg=None)

async def issue(sku: str, wh: str, qty: float, ref: str, user_id: int = 1,
                engine: AsyncEngine | None = None):
    engine = engine or get_engine()
    method = await get_method(engine)
    async with engine.begin() as conn:
        if method == "MOVING_AVG":
            r = await conn.execute(SQL_AVG_ISSUE, dict(sku=sku, wh=wh, qty=qty, ref=ref, uid=user_id))
            cost_used = float(r.scalar())
            return dict(method=method, cost_used=cost_used)
        else:
            r = await conn.execute(SQL_FIFO_ISSUE, dict(sku=sku, wh=wh, qty=qty, ref=ref, uid=user_id))
            cost_used = float(r.scalar())
            return dict(method=method, cost_used=cost_used)

async def report_balance(engine: AsyncEngine | None = None):
    engine = engine or get_engine()
    async with engine.connect() as conn:
        r = await conn.execute(SQL_BALANCE)
        return [dict(sku=a, wh=b, onhand=float(c)) for a,b,c in r.all()]

async def report_valuation(method: str, engine: AsyncEngine | None = None):
    engine = engine or get_engine()
    method = method.upper()
    query = SQL_VALUATION_AVG if method in ("AVG", "MOVING_AVG") else SQL_VALUATION_FIFO
    async with engine.connect() as conn:
        r = await conn.execute(query)
        return [dict(sku=a, wh=b, onhand=float(c), stock_value=float(d)) for a,b,c,d in r.all()]
