#!/usr/bin/env bash
set -euo pipefail

FILE="backend/app/main.py"
[ -f "$FILE" ] || { echo "❌ not found: $FILE"; exit 1; }

# Backup
TS=$(date +%Y%m%d-%H%M%S)
cp "$FILE" "$FILE.bak.$TS"
echo "📦 backup: $FILE.bak.$TS"

# Patch imports (idempotent)
python3 - <<'PY'
from pathlib import Path
import re

p = Path("backend/app/main.py")
s = p.read_text(encoding="utf-8")

# 1) แก้บรรทัด import จาก fastapi.security ให้เหลือเฉพาะ HTTPBearer, HTTPAuthorizationCredentials
s = re.sub(
    r'from\s+fastapi\.security\s+import\s+([^\n]+)',
    lambda m: (
        "from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials"
        if any(x in m.group(1) for x in ["HTTPException","APIRouter","Request","Depends"])
        else m.group(0)
    ),
    s,
    count=1
)

# 2) ให้มี import จาก fastapi ครบชุด
#   - ถ้ามี "from fastapi import FastAPI" อยู่แล้ว ให้ขยายเป็นรายการเต็ม
if re.search(r'^\s*from\s+fastapi\s+import\s+FastAPI\s*(?:,.*)?$', s, flags=re.M):
    s = re.sub(
        r'^\s*from\s+fastapi\s+import\s+FastAPI\s*(?:,.*)?$',
        'from fastapi import FastAPI, HTTPException, APIRouter, Request, Depends',
        s,
        flags=re.M
    )
elif "from fastapi import" in s:
    # มี import อื่นจาก fastapi แต่ไม่มี FastAPI → เติมบรรทัดใหม่
    s = s.replace(
        "from fastapi import",
        "from fastapi import FastAPI, HTTPException, APIRouter, Request, Depends\nfrom fastapi import",
        1
    )
else:
    # ไม่มีเลย → แทรกหลังบรรทัดแรกที่เป็น import
    s = re.sub(
        r'^(.*?\n)',
        r'\1from fastapi import FastAPI, HTTPException, APIRouter, Request, Depends\n',
        s,
        count=1,
        flags=re.S
    )

Path("backend/app/main.py").write_text(s, encoding="utf-8")
print("✅ patched imports in backend/app/main.py")
PY

echo
echo "🔁 rebuild & restart backend..."
docker compose up -d --build backend

echo -n "⏳ wait health via proxy: "
for i in {1..30}; do
  code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8888/api/health || true)
  [ "$code" = "200" ] && { echo "OK"; break; }
  sleep 1
done
[ "${code:-ERR}" = "200" ] || { echo "❌ health FAIL"; docker compose logs -n 200 backend; exit 1; }

echo
echo "🔑 quick login test"
API=${API:-http://127.0.0.1:8888}
ACC=${ACC:-admin}
PASS=${PASS:-admin}
JSON=$(curl -sS -H 'Content-Type: application/json' -d "{\"username\":\"$ACC\",\"password\":\"$PASS\"}" "$API/api/auth/login" || true)
echo "login: $JSON"
TOKEN=$(python3 - <<'PY'
import sys,json
try:
    d=json.loads(sys.stdin.read() or "{}")
except Exception:
    d={}
print(d.get("access_token") or d.get("token") or d.get("jwt") or (d.get("data") or {}).get("access_token") or "")
PY
<<<"$JSON")
[ -n "$TOKEN" ] || { echo "❌ no token"; exit 1; }
echo "TOKEN: ${TOKEN:0:12}..."

echo
echo "✅ done."
