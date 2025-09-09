#!/usr/bin/env bash
set -euo pipefail

API=${API:-http://localhost:8080/api}

echo "==> Write shim routers on host (if missing)"
python3 - <<'PY'
from pathlib import Path
import textwrap

# shim: customers, quotations list, sales-orders, sales-reps, reports
shim = Path("backend/app/routers/shim.py")
shim.parent.mkdir(parents=True, exist_ok=True)
shim.write_text(textwrap.dedent('''\
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
'''), encoding='utf-8')

# shim_admin: roles / perms เบา ๆ
shim_admin = Path("backend/app/routers/shim_admin.py")
shim_admin.parent.mkdir(parents=True, exist_ok=True)
shim_admin.write_text(textwrap.dedent('''\
from fastapi import APIRouter
router = APIRouter()

_roles = [{"id":"shim-role-1","name":"superadmin","description":"full access","perms":["*"]}]
_perms = ["*","products:read","quote:read"]

@router.get("/admin/roles")
async def list_roles():
    return _roles

@router.post("/admin/roles")
async def create_role(payload: dict):
    r = {"id": payload.get("id","shim-role-2"), "name": payload.get("name","role"), "description": payload.get("description",""), "perms":[]}
    _roles.append(r); return r

@router.put("/admin/roles/{rid}")
async def update_role(rid: str, payload: dict):
    for r in _roles:
        if r["id"]==rid:
            r.update({k:v for k,v in payload.items() if k in ("name","description")})
            return r
    return {"detail":"not found"}

@router.delete("/admin/roles/{rid}")
async def delete_role(rid: str):
    global _roles
    _roles = [r for r in _roles if r["id"]!=rid]
    return {"ok": True}

@router.put("/admin/roles/{rid}/perms")
async def set_role_perms(rid: str, payload: dict):
    perms = payload.get("perms", [])
    for r in _roles:
        if r["id"]==rid:
            r["perms"] = perms
            return r
    return {"detail":"not found"}

@router.get("/admin/perms")
async def list_perms():
    return _perms
'''), encoding='utf-8')

print("[OK] shim.py & shim_admin.py written")
PY

echo "==> Backup and write SAFE main.py (idempotent)"
cp -n backend/app/main.py backend/app/main.py.bak-rescue-$(date +%Y%m%d%H%M%S) 2>/dev/null || true
cat > backend/app/main.py <<'PY'
from __future__ import annotations

import os, asyncio, importlib, logging
import sqlalchemy as sa
from fastapi import FastAPI, HTTPException, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import create_async_engine

log = logging.getLogger("uvicorn.error")

API_PREFIX = "/api"

app = FastAPI(
    title="SVS-Ops API",
    version="0.1.0",
    docs_url=f"{API_PREFIX}/docs",
    redoc_url=None,
    openapi_url=f"{API_PREFIX}/openapi.json",
)

ALLOWED_ORIGINS = [
    "http://localhost:5173","http://127.0.0.1:5173",
    "http://localhost:4173","http://127.0.0.1:4173",
    "http://localhost:8888","http://127.0.0.1:8888",
    "http://localhost:8081","http://127.0.0.1:8081",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE_URL = os.environ.get("DATABASE_URL")
_engine = create_async_engine(DATABASE_URL, echo=False, pool_pre_ping=True) if DATABASE_URL else None

sys_router = APIRouter()
@sys_router.get("/health")
def health(): return {"ok": True}

@sys_router.get("/ready")
async def ready():
    if not _engine:
        raise HTTPException(status_code=503, detail="DATABASE_URL not set")
    try:
        async with _engine.connect() as conn:
            await asyncio.wait_for(conn.execute(sa.text("select 1")), timeout=3.0)
        return {"ready": True}
    except asyncio.TimeoutError:
        raise HTTPException(status_code=503, detail="DB ping timed out")
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"DB not ready: {type(e).__name__}: {e}")

app.include_router(sys_router, prefix=API_PREFIX)

def safe_include(module_path: str, *, prefix: str = API_PREFIX, attr: str = "router"):
    try:
        mod = importlib.import_module(module_path)
        router = getattr(mod, attr)
        app.include_router(router, prefix=prefix)
        log.info("Included router: %s", module_path)
    except Exception as e:
        log.exception("Failed to include router %s: %s", module_path, e)

# ---- include routers (order matters) ----
safe_include("app.routers.health")         # ok if exists
safe_include("app.routers.auth")
safe_include("app.routers.admin_users")
safe_include("app.routers.inventory")
safe_include("app.routers.sessions")
safe_include("app.routers.admin_sessions")
safe_include("app.routers.reports")
safe_include("app.routers.products")       # expects paths starting with /products under API_PREFIX
safe_include("app.routers.dashboard")
safe_include("app.routers.quotations")
safe_include("app.routers.purchases")
safe_include("app.routers.quotation_pdf")
safe_include("app.routers.quote_catalog")  # before sales to avoid path collision

# shim endpoints (enable FE pages to open while real routers are WIP)
safe_include("app.routers.shim")           # customers, quotations list, sales-orders, sales-reps, reports
safe_include("app.routers.shim_admin")     # roles & perms shim

safe_include("app.routers.sales")          # keep at the end
PY

echo "==> Rebuild & restart backend"
docker compose build backend >/dev/null
docker compose up -d backend >/dev/null

echo "==> Wait ready"
for i in $(seq 1 60); do
  if curl -fsS "$API/ready" >/dev/null 2>&1; then echo "   ready OK"; break; fi
  sleep 1
  if [ $i -eq 60 ]; then echo "   backend not ready"; docker compose logs backend --tail=100; exit 1; fi
done

echo "==> Probe failing endpoints"
API="$API" bash debug_pages.sh customers   || true
API="$API" bash debug_pages.sh quotations  || true
API="$API" bash debug_pages.sh sos         || true
API="$API" bash debug_pages.sh salesreps   || true
API="$API" bash debug_pages.sh reports     || true
API="$API" bash debug_pages.sh admin       || true

echo "==> done"
