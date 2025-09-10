set -euo pipefail

API="${API:-http://127.0.0.1:8888}"
ACC="${ACC:-admin}"
PASS="${PASS:-admin}"
SKU="${SKU:-CLI-TEST-001}"

FILE="backend/app/main.py"
[ -f "$FILE" ] || { echo "❌ not found: $FILE"; exit 1; }

echo "📦 backup: $FILE.bak.$(date +%Y%m%d-%H%M%S)"
cp -a "$FILE" "$FILE.bak.$(date +%Y%m%d-%H%M%S)"

python3 - "$FILE" <<'PY'
import io,sys,re,os
p=sys.argv[1]
s=open(p,'r',encoding='utf-8').read()

# 1) แก้ import ให้ถูกต้อง
s=re.sub(r'from\s+fastapi\.security\s+import\s+([^#\n]*\bHTTPException\b[^#\n]*)',
         lambda m: m.group(0).replace('fastapi.security','fastapi').replace('HTTPBearer, ','').replace('HTTPAuthorizationCredentials, ',''), s)
if 'from fastapi.security import HTTPBearer' not in s:
    s=s.replace('from fastapi import FastAPI',
                'from fastapi import FastAPI, HTTPException, APIRouter, Request, Depends\nfrom fastapi.security import HTTPBearer, HTTPAuthorizationCredentials')

# 2) แทรก alias สำหรับ current user (prefer import ตรง)
anchor='log = logging.getLogger("uvicorn.error")'
inject = r'''
# --- resolved current user dependency (prefer the one from app.routers.auth) ---
try:
    from app.routers.auth import get_current_user as _current_user  # FastAPI will inject dependencies (bearer/cookies) itself
except Exception:
    async def _current_user(request: Request):
        import importlib, inspect
        try:
            mod = importlib.import_module("app.routers.auth")
            for name in ("get_current_user","get_current_user_or_401","current_user","require_user","get_user","get_me"):
                fn = getattr(mod, name, None)
                if fn:
                    if inspect.iscoroutinefunction(fn):
                        return await fn(request)   # type: ignore
                    return fn(request)             # type: ignore
            raise RuntimeError("no current_user provider in app.routers.auth")
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=401, detail="auth unavailable")
'''
if '_current_user(' not in s:
    s=s.replace(anchor, anchor+inject)

# 3) ใช้ Depends(_current_user) ทุกที่
s=re.sub(r'Depends\(\s*_current_user_dep\s*\)', 'Depends(_current_user)', s)
s=re.sub(r'Depends\(\s*_resolve_current_user\s*\)', 'Depends(_current_user)', s)
s=re.sub(r'Depends\(\s*get_current_user\s*\)', 'Depends(_current_user)', s)

open(p,'w',encoding='utf-8').write(s)
print("✅ patched:", p)
PY

echo
echo "🔁 rebuild & restart backend..."
docker compose up -d --build backend >/dev/null
echo "⏳ wait health via proxy..."
for i in {1..40}; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$API/api/health" || true)
  [ "$code" = "200" ] && { echo "OK"; break; }
  sleep 0.5
  [ $i -eq 40 ] && { echo "❌ health check failed ($code)"; exit 1; }
done

echo
echo "🔑 login and capture token"
JSON=$(curl -sS -H 'Content-Type: application/json' -d "{\"username\":\"$ACC\",\"password\":\"$PASS\"}" "$API/api/auth/login" || true)
TOKEN=$(J="$JSON" python3 -c 'import os,json; d=json.loads(os.environ["J"] or "{}"); print(d.get("access_token") or d.get("token") or d.get("jwt") or (d.get("data") or {}).get("access_token") or "")')
[ -n "$TOKEN" ] || { echo "❌ no token from login: $JSON"; exit 1; }
echo "TOKEN: ${TOKEN:0:12}..."

echo
echo "▶ test upsert with bearer"
curl -iS -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"sku":"'"$SKU"'","name":"CLI Test Product","unit":"EA","team_code":"STD","group_code":"CHEM-REF","group_name":"Chem Ref","is_domestic":true,"group_tag":"ORG-LOCAL"}' \
  "$API/api/products/upsert" || true

echo
echo "▶ verify get"
curl -iS -H "Authorization: Bearer $TOKEN" "$API/api/products/get?sku=$SKU" || true

echo
echo "✅ done"
