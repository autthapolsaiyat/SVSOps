# FILE: app/routers/products_list.py
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
import psycopg
import os

router = APIRouter(prefix="/api/products", tags=["products"])

DB_DSN = os.getenv("DATABASE_URL") or \
         f"postgresql://{os.getenv('POSTGRES_USER','svs')}:{os.getenv('POSTGRES_PASSWORD','svs')}@" \
         f"{os.getenv('POSTGRES_HOST','db')}:{os.getenv('POSTGRES_PORT','5432')}/{os.getenv('POSTGRES_DB','svssystem')}"

class ProductRow(BaseModel):
    sku: str
    name: str | None = None
    unit: str | None = None
    team_code: str | None = None
    group_code: str | None = None
    group_name: str | None = None
    is_domestic: bool | None = None
    group_tag: str | None = None

class ProductListResp(BaseModel):
    items: list[ProductRow]
    total: int

@router.get("/list", response_model=ProductListResp)
def list_products(
    q: str = Query("", description="ค้นหา SKU/ชื่อ"),
    team_code: str | None = None,
    group_code: str | None = None,
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    conds = []
    params = {}
    if q:
        conds.append("(sku ILIKE %(q)s OR name ILIKE %(q)s)")
        params["q"] = f"%{q}%"
    if team_code:
        conds.append("team_code = %(team)s")
        params["team"] = team_code
    if group_code:
        conds.append("group_code = %(g)s")
        params["g"] = group_code

    where = ("WHERE " + " AND ".join(conds)) if conds else ""
    sql = f"""
      SELECT sku, name, unit, team_code, group_code, group_name, is_domestic, group_tag
        FROM v_products_full
        {where}
        ORDER BY sku
        LIMIT %(limit)s OFFSET %(offset)s;
    """
    sql_count = f"SELECT count(*) FROM v_products_full {where};"
    params["limit"] = limit
    params["offset"] = offset

    with psycopg.connect(DB_DSN) as conn:
        with conn.cursor() as cur:
            cur.execute(sql_count, params)
            total = cur.fetchone()[0]
            cur.execute(sql, params)
            rows = [
                ProductRow(
                    sku=r[0], name=r[1], unit=r[2], team_code=r[3],
                    group_code=r[4], group_name=r[5],
                    is_domestic=r[6], group_tag=r[7]
                ) for r in cur.fetchall()
            ]
    return ProductListResp(items=rows, total=total)

