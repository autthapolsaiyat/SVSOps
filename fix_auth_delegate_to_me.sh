set -euo pipefail

API="${API:-http://127.0.0.1:8888}"
ACC="${ACC:-admin}"
PASS="${PASS:-admin}"
SKU="${SKU:-CLI-TEST-001}"

MP="backend/app/main.py"
REQ="backend/requirements.txt"

[ -f "$MP" ]  || { echo "❌ not found: $MP"; exit 1; }
[ -f "$REQ" ] || { echo "❌ not found: $REQ"; exit 1; }

echo "📦 backup: $MP.bak.$(date +%Y%m%d-%H%M%S)"
cp -a "$MP" "$MP.bak.$(date +%Y%m%d-%H%M%S)"

# 1) ให้มี httpx ใน requirements (ถ้ายังไม่มี)
if ! grep -qi '^httpx' "$REQ"; then
  echo "httpx==0.27.*" >> "$REQ"
  echo "➕ added httpx to $REQ"
fi

# 2) แก้ main.py: สร้าง dependency _current_user ที่เรียก /api/auth/me ภายในแอป
python3 - "$MP" <<'PY'
import sys,re
p=sys.argv[1]
s=open(p,'r',encoding='utf-8').read()

# import ให้ครบ (HTTPException มาจาก fastapi)
if 'from fastapi import FastAPI' in s and 'HTTPException' not in s:
    s=s.replace('from fastapi import FastAPI','from fastapi import FastAPI, HTTPException, APIRouter, Request, Depends')
if 'from fastapi.security import HTTPBearer' not in s:
    s=s.replace('from fastapi import FastAPI','from fastapi import FastAPI\nfrom fastapi.security import HTTPBearer, HTTPAuthorizationCredentials')

# ลบตัวเก่า (_current_user_dep/_resolve_current_user) ถ้ามีการอ้างอิง
s=re.sub(r'Depends\(\s*_current_user_dep\s*\)', 'Depends(_current_user)', s)
s=re.sub(r'Depends\(\s*_resolve_current_user\s*\)', 'Depends(_current_user)', s)
s=re.sub(r'Depends\(\s*get_current_user\s*\)', 'Depends(_current_user)', s)

inject = r'''
# --- dependency: delegate auth to /api/auth/me via in-app HTTP ---
try:
    from app.routers.auth import get_current_user as _current_user  # ถ้ามี ให้ใช้ของเดิม (FastAPI จะ inject ให้ครบ)
except Exception:
    _bearer = HTTPBearer(auto_error=False)
    async def _current_user(request: Request):
        try:
            # ดึง Authorization header (รองรับทั้ง Bearer และ Cookie session ถ้ามี)
            auth = request.headers.get("authorization")
            headers = {"authorization": auth} if auth else {}
            # เรียก in-memory ASGI ไปที่ /api/auth/me (ไม่ต้องออกนอกเครื่อง)
            import httpx
            base = "http://local"
            prefix = globals().get("API_PREFIX", "/api")
            url = f"{base}{prefix}/auth/me"
            async with httpx.AsyncClient(app=request.app, base_url=base, timeout=5.0) as c:
                r = await c.get(url, headers=headers)
            if r.status_code == 200:
                return r.json()  # ควรเป็น user dict ที่ route auth ใช้อยู่
            try:
                detail = r.json().get("detail","unauthorized")
            except Exception:
                detail = r.text or "unauthorized"
            raise HTTPException(status_code=r.status_code, detail=detail)
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=401, detail="auth unavailable")
'''
anchor='log = logging.getLogger("uvicorn.error")'
if '_current_user(' not in s:
    s=s.replace(anchor, anchor+inject)

open(p,'w',encoding='utf-8').write(s)
print("✅ patched:", p)
PY

echo
echo "🔁 rebuild & restart backend (pip will install httpx if added)..."
docker compose up -d --build backend >/dev/null
echo -n "⏳ wait health: "
for i in {1..60}; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$API/api/health" || true)
  [ "$code" = "200" ] && { echo "OK"; break; }
  sleep 0.5
  [ $i -eq 60 ] && { echo "❌ FAIL ($code)"; exit 1; }
done

echo
echo "🔑 login"
JSON=$(curl -sS -H 'Content-Type: application/json' -d "{\"username\":\"$ACC\",\"password\":\"$PASS\"}" "$API/api/auth/login" || true)
TOKEN=$(J="$JSON" python3 -c 'import os,json; d=json.loads(os.environ["J"] or "{}"); print(d.get("access_token") or d.get("token") or d.get("jwt") or (d.get("data") or {}).get("access_token") or "")')
[ -n "$TOKEN" ] || { echo "❌ no token: $JSON"; exit 1; }
echo "TOKEN: ${TOKEN:0:12}..."

echo
echo "▶ upsert with bearer (expect 200)"
curl -iS -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"sku":"'"$SKU"'","name":"CLI Test Product","unit":"EA","team_code":"STD","group_code":"CHEM-REF","group_name":"Chem Ref","is_domestic":true,"group_tag":"ORG-LOCAL"}' \
  "$API/api/products/upsert" || true

echo
echo "▶ me (sanity)"
curl -iS -H "Authorization: Bearer $TOKEN" "$API/api/auth/me" || true

echo
echo "✅ done"
