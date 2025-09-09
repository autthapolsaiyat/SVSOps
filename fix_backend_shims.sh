#!/usr/bin/env bash
set -euo pipefail
API=${API:-http://localhost:8080/api}

echo "==> ensure backend container is running"
docker compose up -d backend >/dev/null

echo "==> write shim routers inside container"
# 1) /app/app/routers/shim.py  (customers, quotations list, sales-orders, sales-reps, reports)
docker compose exec -T backend sh -lc 'cat > /app/app/routers/shim.py' <<'PY'
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
PY

# 2) /app/app/routers/shim_admin.py  (roles/perms แบบเบา ๆ)
docker compose exec -T backend sh -lc 'cat > /app/app/routers/shim_admin.py' <<'PY'
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
PY

echo "==> patch main.py imports + includes (place shims before sales)"
docker compose exec -T backend sh -lc 'python - <<PY
from pathlib import Path
import re
p = Path("/app/app/main.py")
s = p.read_text()

# ensure imports
if "from .routers.shim import router as shim_router" not in s:
    s = s.replace("from .routers", "from .routers.shim import router as shim_router\nfrom .routers.shim_admin import router as shim_admin_router\nfrom .routers", 1) \
        if "from .routers" in s else s + "\nfrom .routers.shim import router as shim_router\nfrom .routers.shim_admin import router as shim_admin_router\n"

inc_shim  = "app.include_router(shim_router, prefix=API_PREFIX)"
inc_admin = "app.include_router(shim_admin_router, prefix=API_PREFIX)"

# insert before sales_router include
m = re.search(r"app\\.include_router\\(\\s*sales_router[^)]*\\)", s)
if m:
    before, after = s[:m.start()], s[m.start():]
    add = ""
    if inc_shim not in s:  add += inc_shim + "\\n"
    if inc_admin not in s: add += inc_admin + "\\n"
    s = before + add + after
else:
    # fallback: append near the end of include block
    last = s.rfind("app.include_router(")
    if last != -1:
        nl = s.find("\\n", last)
        add = ""
        if inc_shim not in s:  add += "\\n" + inc_shim
        if inc_admin not in s: add += "\\n" + inc_admin
        s = s[:nl] + add + s[nl:]

p.write_text(s)
print("[OK] main.py updated")
PY'

echo "==> restart backend"
docker compose restart backend >/dev/null

echo "==> wait for ready"
for i in $(seq 1 40); do
  curl -fsS "$API/ready" >/dev/null 2>&1 && break
  sleep 0.5
done

echo "==> probe endpoints that failed"
bash debug_pages.sh customers   || true
bash debug_pages.sh quotations  || true
bash debug_pages.sh sos         || true
bash debug_pages.sh salesreps   || true
bash debug_pages.sh reports     || true
bash debug_pages.sh admin       || true

echo "==> done"
