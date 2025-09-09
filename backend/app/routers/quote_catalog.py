# FILE: backend/app/routers/quote_catalog.py
from __future__ import annotations

import io, csv
import sqlalchemy as sa
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from ..deps import get_db, require_perm as RP

router = APIRouter(prefix="/sales/quote-catalog", tags=["quote-catalog"])

# ===== Schemas =====
class CatalogUpsertIn(BaseModel):
    sku: Optional[str] = None
    part_no: str = Field(min_length=1)
    description: str = Field(min_length=1)
    cas_no: Optional[str] = None
    package_label: Optional[str] = None
    warn_text: Optional[str] = None
    default_price_ex_vat: Optional[float] = Field(default=None, ge=0)

# ===== CRUD & Suggest =====
@router.get("", dependencies=[Depends(RP("quote:read"))])
@router.get("/list", dependencies=[Depends(RP("quote:read"))])  # ⬅️ alias กันชนแน่นอน
async def list_catalog(
    db: AsyncSession = Depends(get_db),
    q: Optional[str] = Query(None, description="ค้นหาใน part_no/description/sku/cas_no"),
    page: int = 1,
    per_page: int = 20,
):
    # normalize page/per_page
    page = max(1, int(page or 1))
    per_page = max(1, min(200, int(per_page or 20)))

    conds = []; params = {"off": (page-1)*per_page, "lim": per_page}
    if q:
        conds.append("(part_no ILIKE :qq OR description ILIKE :qq OR sku ILIKE :qq OR cas_no ILIKE :qq)")
        params["qq"] = f"%{q}%"
    where = ("WHERE " + " AND ".join(conds)) if conds else ""

    total = await db.scalar(sa.text(f"SELECT COUNT(*) FROM quote_catalog {where}"), params)
    rows = await db.execute(sa.text(f"""
      SELECT id, sku, part_no, description, cas_no, package_label, warn_text, default_price_ex_vat
      FROM quote_catalog {where}
      ORDER BY part_no, COALESCE(package_label,'')
      OFFSET :off LIMIT :lim
    """), params)
    return {
        "items": [dict(r) for r in rows.mappings().all()],
        "total": int(total or 0),
        "page": page,
        "per_page": per_page
    }

@router.get("/suggest/{field}", dependencies=[Depends(RP("quote:read"))])
async def suggest_field(field: str, db: AsyncSession = Depends(get_db), q: Optional[str] = None, limit: int = 10):
    allowed = {"part_no","description","cas_no","package_label","warn_text","sku"}
    if field not in allowed:
        raise HTTPException(400, "field not allowed")
    if q:
        sql = sa.text(f"SELECT DISTINCT {field} AS v FROM quote_catalog WHERE {field} ILIKE :qq ORDER BY v NULLS LAST LIMIT :lim")
        rows = await db.execute(sql, {"qq": f"%{q}%", "lim": limit})
    else:
        sql = sa.text(f"SELECT DISTINCT {field} AS v FROM quote_catalog ORDER BY v NULLS LAST LIMIT :lim")
        rows = await db.execute(sql, {"lim": limit})
    return [r["v"] for r in rows.mappings().all() if r["v"]]

@router.get("/{cid}", dependencies=[Depends(RP("quote:read"))])
async def get_catalog(cid: UUID, db: AsyncSession = Depends(get_db)):
    row = await db.execute(sa.text("""
      SELECT id, sku, part_no, description, cas_no, package_label, warn_text, default_price_ex_vat
      FROM quote_catalog WHERE id=:id
    """), {"id": str(cid)})
    m = row.mappings().first()
    if not m: raise HTTPException(404, "not found")
    return dict(m)

@router.post("", dependencies=[Depends(RP("quote:update"))])
async def create_catalog(payload: CatalogUpsertIn, db: AsyncSession = Depends(get_db)):
    r = await db.execute(sa.text("""
      INSERT INTO quote_catalog (sku, part_no, description, cas_no, package_label, warn_text, default_price_ex_vat)
      VALUES (:sku, :part_no, :description, :cas_no, :package_label, :warn_text, :price)
      ON CONFLICT (part_no, COALESCE(package_label,'')) DO UPDATE
      SET sku=EXCLUDED.sku, description=EXCLUDED.description, cas_no=EXCLUDED.cas_no,
          package_label=EXCLUDED.package_label, warn_text=EXCLUDED.warn_text,
          default_price_ex_vat=EXCLUDED.default_price_ex_vat
      RETURNING id
    """), {
      "sku": payload.sku, "part_no": payload.part_no.strip(), "description": payload.description.strip(),
      "cas_no": payload.cas_no, "package_label": payload.package_label, "warn_text": payload.warn_text,
      "price": payload.default_price_ex_vat,
    })
    cid = r.scalar_one()
    await db.commit()
    return {"ok": True, "id": str(cid)}

@router.put("/{cid}", dependencies=[Depends(RP("quote:update"))])
async def update_catalog(cid: UUID, payload: CatalogUpsertIn, db: AsyncSession = Depends(get_db)):
    exist = await db.scalar(sa.text("SELECT 1 FROM quote_catalog WHERE id=:id"), {"id": str(cid)})
    if not exist: raise HTTPException(404, "not found")
    await db.execute(sa.text("""
      UPDATE quote_catalog SET
        sku=:sku, part_no=:part_no, description=:description, cas_no=:cas_no,
        package_label=:package_label, warn_text=:warn_text, default_price_ex_vat=:price
      WHERE id=:id
    """), {
      "id": str(cid),
      "sku": payload.sku, "part_no": payload.part_no.strip(), "description": payload.description.strip(),
      "cas_no": payload.cas_no, "package_label": payload.package_label, "warn_text": payload.warn_text,
      "price": payload.default_price_ex_vat,
    })
    await db.commit()
    return {"ok": True}

@router.delete("/{cid}", dependencies=[Depends(RP("quote:update"))])
async def delete_catalog(cid: UUID, db: AsyncSession = Depends(get_db)):
    await db.execute(sa.text("DELETE FROM quote_catalog WHERE id=:id"), {"id": str(cid)})
    await db.commit()
    return {"ok": True}

# ===== Import helpers =====
def _norm(s: str | None) -> str | None:
    if s is None: return None
    s = str(s).strip()
    return s or None

def _num(v) -> float | None:
    if v is None: return None
    s = str(v).replace(",", "").strip()
    if s == "": return None
    try:
        return float(Decimal(s))
    except Exception:
        return None

_HEADER_MAP = {
    "part_no": {"part no", "partno", "รหัสสินค้า", "รหัส", "itemcode"},
    "description": {"description", "descriptions", "รายละเอียด", "ชื่อสินค้า"},
    "cas_no": {"cas", "cas no", "casno", "เลขcas", "casเลขที่"},
    "package_label": {"package", "pack", "ขนาดบรรจุ", "หน่วย", "unit"},
    "warn_text": {"warn", "หมายเหตุ", "note", "warning"},
    "default_price_ex_vat": {"unit price", "price", "ราคาต่อหน่วย", "ราคา/หน่วย"},
    "sku": {"sku", "รหัสสต็อก"},
}
def _key_of(col: str) -> str | None:
    c = col.lower().strip().replace(".", "").replace("_", " ")
    for k, names in _HEADER_MAP.items():
        if c in names: return k
    return None

def _parse_csv_catalog(file_bytes: bytes) -> list[dict]:
    text = file_bytes.decode("utf-8-sig", errors="ignore")
    rdr = csv.reader(io.StringIO(text))
    rows = list(rdr)
    if not rows: return []
    head = rows[0]
    pos: dict[str, int] = {}
    for i, h in enumerate(head):
        key = _key_of(h or "")
        if key: pos[key] = i
    out: list[dict] = []
    for r in rows[1:]:
        if not any(r): continue
        def get(k):
            i = pos.get(k)
            return r[i].strip() if i is not None and i < len(r) and r[i] is not None else None
        out.append({
            "sku": _norm(get("sku")),
            "part_no": _norm(get("part_no")),
            "description": _norm(get("description")),
            "cas_no": _norm(get("cas_no")),
            "package_label": _norm(get("package_label")),
            "warn_text": _norm(get("warn_text")),
            "default_price_ex_vat": _num(get("default_price_ex_vat")),
        })
    return out

def _parse_xlsx_catalog(file_bytes: bytes) -> list[dict]:
    try:
        import openpyxl  # lazy import
    except Exception as e:
        raise HTTPException(400, f"ต้องติดตั้ง openpyxl สำหรับ .xlsx: {e}")
    wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    if not rows: return []
    head = [str(c or "") for c in rows[0]]
    pos: dict[str, int] = {}
    for i, h in enumerate(head):
        key = _key_of(h or "")
        if key: pos[key] = i
    out: list[dict] = []
    for r in rows[1:]:
        if r is None: continue
        cells = [str(c) if c is not None else "" for c in r]
        if not any(cells): continue
        def get(k):
            i = pos.get(k)
            return (cells[i].strip() if i is not None and i < len(cells) else None)
        out.append({
            "sku": _norm(get("sku")),
            "part_no": _norm(get("part_no")),
            "description": _norm(get("description")),
            "cas_no": _norm(get("cas_no")),
            "package_label": _norm(get("package_label")),
            "warn_text": _norm(get("warn_text")),
            "default_price_ex_vat": _num(get("default_price_ex_vat")),
        })
    return out

@router.post("/import", dependencies=[Depends(RP("quote:update"))])
async def import_quote_catalog(
    file: UploadFile = File(..., description="ไฟล์ .xlsx หรือ .csv"),
    mode: str = Form("upsert"),   # upsert | replace
    db: AsyncSession = Depends(get_db),
):
    """
    นำเข้าข้อมูลฐานแคตตาล็อก (part_no, description, cas_no, package_label, warn_text, default_price_ex_vat, sku)
    - mode=upsert (ค่าเริ่มต้น): แก้/เพิ่มตาม (part_no, COALESCE(package_label,''))
    - mode=replace: ลบทั้งหมดก่อน แล้วค่อยเพิ่ม
    """
    content = await file.read()
    name = (file.filename or "").lower()
    if name.endswith(".csv"):
        items = _parse_csv_catalog(content)
    elif name.endswith(".xlsx"):
        items = _parse_xlsx_catalog(content)
    else:
        raise HTTPException(400, "รองรับเฉพาะ .csv หรือ .xlsx")

    if not items:
        return {"ok": True, "inserted": 0, "mode": mode}

    if mode not in ("upsert", "replace"):
        raise HTTPException(400, "mode ต้องเป็น upsert หรือ replace")

    if mode == "replace":
        await db.execute(sa.text("TRUNCATE quote_catalog RESTART IDENTITY"))

    inserted = 0
    for it in items:
        if not it.get("part_no") and not it.get("description"):
            continue
        await db.execute(sa.text("""
            INSERT INTO quote_catalog (sku, part_no, description, cas_no, package_label, warn_text, default_price_ex_vat)
            VALUES (:sku, :part_no, :description, :cas_no, :package_label, :warn_text, :price)
            ON CONFLICT (part_no, COALESCE(package_label,'')) DO UPDATE
            SET sku=COALESCE(EXCLUDED.sku, quote_catalog.sku),
                description=COALESCE(EXCLUDED.description, quote_catalog.description),
                cas_no=COALESCE(EXCLUDED.cas_no, quote_catalog.cas_no),
                package_label=COALESCE(EXCLUDED.package_label, quote_catalog.package_label),
                warn_text=COALESCE(EXCLUDED.warn_text, quote_catalog.warn_text),
                default_price_ex_vat=COALESCE(EXCLUDED.default_price_ex_vat, quote_catalog.default_price_ex_vat)
        """), {
            "sku": it.get("sku"),
            "part_no": it.get("part_no"),
            "description": it.get("description"),
            "cas_no": it.get("cas_no"),
            "package_label": it.get("package_label"),
            "warn_text": it.get("warn_text"),
            "price": it.get("default_price_ex_vat"),
        })
        inserted += 1

    await db.commit()
    return {"ok": True, "inserted": inserted, "mode": mode}

