#!/usr/bin/env bash
set -euo pipefail

echo "== backend logs (ล่าสุด 200 บรรทัด) =="
docker compose logs -n 200 backend || true

echo
echo "== Restore last backup of backend/app/main.py (ถ้ามี) =="
BK="$(ls -t backend/app/main.py.bak.* 2>/dev/null | head -1 || true)"
if [ -n "$BK" ]; then
  cp "$BK" backend/app/main.py
  echo "Restored from: $BK"
else
  echo "No backup file found. (ข้ามขั้นตอนนี้)"
fi

echo
echo "== Rebuild & restart backend =="
docker compose up -d --build backend

echo
echo -n "== Wait health via proxy (http://127.0.0.1:8888/api/health) "
for i in {1..30}; do
  code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8888/api/health || true)
  [ "$code" = "200" ] && { echo "-> OK"; break; }
  echo -n "."
  sleep 1
done
if [ "${code:-ERR}" != "200" ]; then
  echo " -> FAIL ($code)"
  echo "Hint: ดู error แบบสด ๆ: docker compose logs -f backend"
  exit 1
fi

echo
echo "== Smoke test: login -> upsert -> get =="
API=${API:-http://127.0.0.1:8888}
ACC=${ACC:-admin}
PASS=${PASS:-admin}
SKU=${SKU:-CLI-TEST-RESCUE}

JSON=$(curl -sS -H 'Content-Type: application/json' \
  -d "{\"username\":\"$ACC\",\"password\":\"$PASS\"}" \
  "$API/api/auth/login" || true)
echo "login: $JSON"

TOKEN=$(python3 - <<'PY'
import sys,json
try:
    d=json.loads(sys.stdin.read())
except Exception:
    d={}
print(d.get("access_token") or d.get("token") or d.get("jwt") or (d.get("data") or {}).get("access_token") or "")
PY
<<<"$JSON")

if [ -z "$TOKEN" ]; then
  echo "❌ no token; login ล้มเหลว"; exit 1
fi
echo "TOKEN: ${TOKEN:0:12}..."

echo
echo "-> upsert"
curl -iS -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"sku\":\"$SKU\",\"name\":\"Rescue Product\",\"unit\":\"EA\",\"team_code\":\"STD\",\"group_code\":\"CHEM-REF\",\"group_name\":\"Chem Ref\",\"is_domestic\":true,\"group_tag\":\"ORG-LOCAL\"}" \
  "$API/api/products/upsert"

echo
echo "-> get"
curl -iS -H "Authorization: Bearer $TOKEN" \
  "$API/api/products/get?sku=$SKU"
