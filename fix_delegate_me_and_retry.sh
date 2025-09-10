set -euo pipefail

API="${API:-http://127.0.0.1:8888}"
ACC="${ACC:-admin}"
PASS="${PASS:-admin}"
SKU="${SKU:-CLI-DELEG-001}"

echo "🔧 Fix auth resolver -> forward Authorization & Cookie, try backend/127.0.0.1"
ts=$(date +%Y%m%d-%H%M%S)
cp -a backend/app/main.py "backend/app/main.py.bak.$ts" || true
echo "📦 backup: backend/app/main.py.bak.$ts"

python3 - <<'PY'
from pathlib import Path
import re

p = Path("backend/app/main.py")
s = p.read_text(encoding="utf-8")

# ensure imports
if "from fastapi import HTTPException, APIRouter, Request, Depends" not in s:
    s = s.replace(
        "from fastapi import FastAPI",
        "from fastapi import FastAPI\nfrom fastapi import HTTPException, APIRouter, Request, Depends",
    )
if "import httpx" not in s:
    s = s.replace("import io, csv", "import io, csv\nimport httpx")

block = r'''
# ---- Auth dependency: call /api/auth/me internally (Authorization + Cookie) ----
async def _resolve_current_user(request: Request):
    auth = request.headers.get("Authorization") or request.headers.get("authorization")
    cookie = request.headers.get("Cookie") or request.headers.get("cookie")
    if not auth:
        raise HTTPException(status_code=401, detail="Missing bearer token")

    headers = {"Authorization": auth}
    if cookie:
        headers["Cookie"] = cookie

    urls = [
        os.environ.get("INTERNAL_ME_URL"),
        "http://backend:8000/api/auth/me",       # service name on docker network
        "http://127.0.0.1:8000/api/auth/me",     # loopback inside container
    ]
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            for u in urls:
                if not u: 
                    continue
                try:
                    r = await client.get(u, headers=headers)
                    if r.status_code == 200:
                        return r.json()
                except Exception:
                    # try next fallback
                    pass
    except Exception:
        pass
    raise HTTPException(status_code=401, detail="auth unavailable")
'''

# remove old definitions (optional tidy)
s = re.sub(r'async def _resolve_current_user\([^\0]*?return r\.json\(\)\n[ \t]*\}', '', s, flags=re.S)

# ensure Depends points to resolver
s = re.sub(r'Depends\(\s*_current_user_dep\s*\)', 'Depends(_resolve_current_user)', s)
s = re.sub(r'Depends\(\s*get_current_user\s*\)', 'Depends(_resolve_current_user)', s)
s = re.sub(r'Depends\(\s*current_user\s*\)', 'Depends(_resolve_current_user)', s)

# append (safe)
if "_resolve_current_user(" not in s:
    s += "\n" + block + "\n"

p.write_text(s, encoding="utf-8")
print("✅ patched: backend/app/main.py")
PY

# optional: ensure INTERNAL_ME_URL in compose override
if [ ! -f docker-compose.override.yml ] || ! grep -q INTERNAL_ME_URL docker-compose.override.yml; then
  cat > docker-compose.override.yml <<'YML'
services:
  backend:
    environment:
      INTERNAL_ME_URL: "http://backend:8000/api/auth/me"
YML
  echo "🧩 wrote docker-compose.override.yml (INTERNAL_ME_URL=http://backend:8000/api/auth/me)"
else
  echo "ℹ️ docker-compose.override.yml already present"
fi

echo
echo "🔁 rebuild & restart backend..."
docker compose up -d --build backend >/dev/null

echo -n "⏳ wait health: "
for i in $(seq 1 60); do
  if curl -fsS "$API/api/health" >/dev/null; then echo "OK"; break; fi
  sleep 0.5
  if [ "$i" = 60 ]; then echo "FAIL"; exit 1; fi
done

echo
echo "🔑 login"
LOGIN=$(curl -sS -H 'Content-Type: application/json' -d '{"username":"'"$ACC"'","password":"'"$PASS"'"}' "$API/api/auth/login")
TOKEN=$(python3 -c 'import sys,json; d=json.loads(sys.argv[1]); print(d.get("access_token") or (d.get("data") or {}).get("access_token") or "")' "$LOGIN")
echo "TOKEN: ${TOKEN:0:12}..."

echo
echo "▶ sanity /api/auth/me"
curl -iS -H "Authorization: Bearer $TOKEN" "$API/api/auth/me" >/dev/null

echo
echo "────────────────────────────────────────────────────────"
echo "▶ upsert"
curl -iS -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"sku":"'"$SKU"'","name":"Deleg UP","unit":"EA","team_code":"STD","group_code":"GLASS","group_name":"เครื่องแก้ว","is_domestic":true,"group_tag":"auto"}' \
  "$API/api/products/upsert"

echo
echo "────────────────────────────────────────────────────────"
echo "▶ verify get"
curl -iS -H "Authorization: Bearer $TOKEN" "$API/api/products/get?sku=$SKU"
echo
