#!/usr/bin/env bash
set -euo pipefail
FILE="backend/app/main.py"
[ -f "$FILE" ] || { echo "❌ not found: $FILE"; exit 1; }

cp -a "$FILE" "$FILE.bak.$(date +%Y%m%d-%H%M%S)"

python3 - <<'PY'
from pathlib import Path
import re

p = Path("backend/app/main.py")
s = p.read_text(encoding="utf-8")

# 1) นำเข้าที่ต้องใช้ (ถ้ายังไม่มี)
imports = []
if "HTTPException" not in s:
    imports.append("from fastapi import HTTPException")
if "APIRouter" not in s:
    imports.append("from fastapi import APIRouter")
if "Request" not in s:
    imports.append("from fastapi import Request")
if "Depends" not in s:
    imports.append("from fastapi import Depends")
if "HTTPBearer" not in s:
    imports.append("from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials")

if imports:
    s = s.replace("from fastapi import FastAPI", "from fastapi import FastAPI\n" + "\n".join(imports))

# 2) เพิ่ม security bearer (ครั้งเดียวพอ)
if "security = HTTPBearer(" not in s:
    s = s.replace("app = FastAPI(", "security = HTTPBearer(auto_error=False)\n\napp = FastAPI(")

# 3) ฟังก์ชัน helper ถอด JWT + fetch roles แบบ dynamic + ตัว resolver ใหม่
inject = r'''
# ==== Robust auth resolver (import -> token decode -> DB roles) ====
def _jwt_decode_hs256(token: str):
    import os, json
    secret = os.environ.get("JWT_SECRET") or os.environ.get("SECRET_KEY") or ""
    if not secret:
        raise HTTPException(status_code=401, detail="JWT secret not set")
    # ลองทั้ง python-jose และ PyJWT
    try:
        from jose import jwt as _jose_jwt
        return _jose_jwt.decode(token, secret, algorithms=["HS256"])
    except Exception:
        try:
            import jwt as _pyjwt
            return _pyjwt.decode(token, secret, algorithms=["HS256"])
        except Exception as e:
            raise HTTPException(status_code=401, detail=f"invalid token: {type(e).__name__}")

async def _get_roles_by_user_id(uid: str):
    # พยายามหา roles จาก admin_users แบบ dynamic หลายรูปแบบสคีมา
    if _engine is None:
        return []
    import sqlalchemy as sa
    async with _engine.connect() as conn:
        # ดูว่ามีคอลัมน์อะไรบ้าง
        cols = set(r[0].lower() for r in (await conn.execute(sa.text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_schema = current_schema() AND table_name='admin_users'"
        ))).all())
        # ผู้สมัคร query:
        candidates = []
        # role_names เป็น text[] หรือ json?
        if "role_names" in cols:
            candidates.append((
                "SELECT COALESCE(role_names, ARRAY[]::text[]) AS roles FROM admin_users WHERE id::text=:uid OR username=:uid LIMIT 1",
                {}
            ))
        if "roles" in cols:
            # roles เป็น jsonb array ของ text
            candidates.append((
                "SELECT COALESCE((SELECT array_agg(value::text) FROM jsonb_array_elements_text(roles)), ARRAY[]::text[]) AS roles "
                "FROM admin_users WHERE id::text=:uid OR username=:uid LIMIT 1",
                {}
            ))
        if not candidates:
            # fallback: ถ้าไม่รู้สคีมา ให้คืนว่างไปก่อน
            return []
        for sql, params in candidates:
            try:
                row = (await conn.execute(sa.text(sql), {"uid": uid})).first()
                if row and row[0] is not None:
                    return list(row[0])
            except Exception:
                continue
    return []

async def _resolve_current_user(request: Request, creds: HTTPAuthorizationCredentials = Depends(security)):
    import importlib, inspect, logging
    log = logging.getLogger("uvicorn.error")
    # 1) ลองใช้ของแท้ใน app.routers.auth ก่อน (หลายชื่อ หลาย signature)
    try:
        mod = importlib.import_module("app.routers.auth")
        cands = ("get_current_user","get_current_user_or_401","current_user","require_user","get_user","get_me")
        for name in cands:
            fn = getattr(mod, name, None)
            if not fn: continue
            try:
                sig = inspect.signature(fn)
                # ตรองจากพารามิเตอร์
                if any(p.kind in (p.POSITIONAL_ONLY, p.POSITIONAL_OR_KEYWORD) and p.name=="request" for p in sig.parameters.values()):
                    return await fn(request) if inspect.iscoroutinefunction(fn) else fn(request)  # type: ignore
                if any(p.name in ("token","credentials","creds") for p in sig.parameters.values()) and creds:
                    arg = creds.credentials if hasattr(creds,"credentials") and creds else None
                    return await fn(arg) if inspect.iscoroutinefunction(fn) else fn(arg)  # type: ignore
                # ไม่มีอาร์กิวเมนต์
                return await fn() if inspect.iscoroutinefunction(fn) else fn()  # type: ignore
            except Exception as e:
                log.warning("auth resolver via %s failed: %s", name, type(e).__name__)
                continue
    except Exception as e:
        log.warning("auth module import failed: %s", type(e).__name__)

    # 2) ถอด JWT เอง (HS256 + JWT_SECRET/SECRET_KEY) แล้วเติม roles จาก DB
    if not creds or not getattr(creds, "credentials", None):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    claims = _jwt_decode_hs256(creds.credentials)
    uid = str(claims.get("sub") or "")
    if not uid:
        raise HTTPException(status_code=401, detail="invalid token: no sub")
    roles = await _get_roles_by_user_id(uid)
    return {"id": uid, "role_names": roles, "roles": roles}
'''

if "_resolve_current_user(" not in s:
    # แทรกหลังประกาศ app หรือหลัง log = ...
    anchor = "log = logging.getLogger(\"uvicorn.error\")"
    if anchor in s:
        s = s.replace(anchor, anchor + "\n" + inject)
    else:
        s = s.replace("app = FastAPI(", inject + "\napp = FastAPI(")

# 4) แทนที่ Depends ที่ใช้เดิม ให้ชี้มา _resolve_current_user
s = re.sub(r"Depends\(\s*_current_user_dep\s*\)", "Depends(_resolve_current_user)", s)
s = re.sub(r"Depends\(\s*get_current_user\s*\)", "Depends(_resolve_current_user)", s)

Path("backend/app/main.py").write_text(s, encoding="utf-8")
print("patched:", p)
PY

echo "✅ Patched. Rebuilding backend..."
docker compose up -d --build backend >/dev/null

echo "⏳ Wait health..."
for i in {1..30}; do
  code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8888/api/health || true)
  [ "$code" = "200" ] && { echo "OK"; break; }
  sleep 1
done
