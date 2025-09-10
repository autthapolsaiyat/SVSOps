set -euo pipefail

API="${API:-http://127.0.0.1:8888}"
ACC="${ACC:-admin}"
PASS="${PASS:-admin}"
SKU="${SKU:-CLI-DELEG-001}"

echo "📦 patch auth dependency in backend/app/main.py + rebuild & test"
echo "API=$API ACC=$ACC SKU=$SKU"

# 1) backup
ts=$(date +%Y%m%d-%H%M%S)
cp -a backend/app/main.py "backend/app/main.py.bak.$ts" || true
echo "backup -> backend/app/main.py.bak.$ts"

# 2) patch main.py : เพิ่ม httpx resolver และเปลี่ยน Depends(..)
python3 - <<'PY'
from pathlib import Path
import re

p = Path("backend/app/main.py")
s = p.read_text(encoding="utf-8")

def ensure_import(block: str):
    global s
    if block not in s:
        # แทรกหลังบรรทัด import เบื้องต้น
        s = s.replace("from fastapi import FastAPI",
                      "from fastapi import FastAPI\n" + block)

# (a) ให้มี import ที่ถูกต้อง
ensure_import("from fastapi import HTTPException, APIRouter, Request, Depends")
if "import httpx" not in s:
    s = s.replace("import io, csv", "import io, csv\nimport httpx")

# (b) แทรก resolver แบบ delegate หา /api/auth/me ภายใน
if "_resolve_current_user(" not in s:
    inject = r'''
# ---- Auth dependency: delegate to /api/auth/me with the incoming Bearer ----
async def _resolve_current_user(request: Request):
    auth = request.headers.get("authorization")
    if not auth:
        raise HTTPException(status_code=401, detail="Missing bearer token")
    url = os.environ.get("INTERNAL_ME_URL", "http://127.0.0.1:8000/api/auth/me")
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(url, headers={"Authorization": auth})
        if r.status_code != 200:
            # ส่งสถานะจริงกลับไป จะช่วยดีบักได้
            raise HTTPException(status_code=r.status_code, detail="auth unavailable")
        return r.json()
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="auth unavailable")
'''
    # ใส่ไว้หลังฟังก์ชัน _roles_of ถ้ามี ไม่งั้นใส่หลังประกาศ app
    if "_roles_of(" in s:
        s = s.replace("_roles_of(", "_roles_of(") + inject
    else:
        s = s.replace("app = FastAPI(", "app = FastAPI(") + inject

# (c) เปลี่ยน Depends(..) ทั้งหมดให้ใช้ตัวใหม่
s = re.sub(r'Depends\(\s*_current_user_dep\s*\)', 'Depends(_resolve_current_user)', s)
s = re.sub(r'Depends\(\s*get_current_user\s*\)', 'Depends(_resolve_current_user)', s)
s = re.sub(r'Depends\(\s*current_user\s*\)', 'Depends(_resolve_current_user)', s)

Path("backend/app/main.py").write_text(s, encoding="utf-8")
print("patched backend/app/main.py")
PY

# 3) ensure requirements มี httpx และ pin passlib บนเวอร์ชันนิ่ง
python3 - <<'PY'
from pathlib import Path, re as _re
rq = Path("backend/requirements.txt")
txt = rq.read_text() if rq.exists() else ""
changed = False
if "httpx" not in txt:
    txt += ("" if txt.endswith("\n") else "\n") + "httpx>=0.25\n"; changed = True
if _re.search(r'^passlib', txt, flags=_re.M):
    txt = _re.sub(r'^passlib.*$', 'passlib[bcrypt]==1.7.4', txt, flags=_re.M); changed = True
else:
    txt += "passlib[bcrypt]==1.7.4\n"; changed = True
if changed:
    rq.write_text(txt)
    print("requirements updated")
else:
    print("requirements ok")
PY

# 4) rebuild & restart backend
docker compose up -d --build backend >/dev/null
echo "⏳ wait health via proxy..."
for i in $(seq 1 40); do
  if curl -fsS "$API/api/health" >/dev/null; then echo "OK"; break; fi
  sleep 0.5
  if [ "$i" = "40" ]; then echo "FAIL health"; exit 1; fi
done

# 5) login & get token
LOGIN=$(curl -sS -H 'Content-Type: application/json' \
  -d '{"username":"'"$ACC"'","password":"'"$PASS"'"}' "$API/api/auth/login" || true)
TOKEN=$(python3 -c 'import sys,json; d=json.loads(sys.argv[1]); print(d.get("access_token") or (d.get("data") or {}).get("access_token") or "")' "$LOGIN" 2>/dev/null || true)
echo "TOKEN: ${TOKEN:0:12}..."

# sanity: /me
curl -iS -H "Authorization: Bearer $TOKEN" "$API/api/auth/me" >/dev/null

# 6) try upsert with bearer
echo "▶ upsert with bearer"
curl -iS -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"sku":"'"$SKU"'","name":"Deleg UP","unit":"EA","team_code":"STD","group_code":"GLASS","group_name":"เครื่องแก้ว","is_domestic":true,"group_tag":"auto"}' \
  "$API/api/products/upsert"

# 7) verify
echo
echo "▶ verify get"
curl -iS -H "Authorization: Bearer $TOKEN" "$API/api/products/get?sku=$SKU"
echo
