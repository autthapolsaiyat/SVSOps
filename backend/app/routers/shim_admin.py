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
