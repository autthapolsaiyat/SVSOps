#!/usr/bin/env bash
set -euo pipefail

API="${API:-http://127.0.0.1:8888}"
ACC="${ACC:-admin}"
PASS="${PASS:-admin}"
SKU="${SKU:-CLI-TEST-001}"

line(){ printf '\n%s\n' "────────────────────────────────────────────────────────"; }

echo "SVS-Ops Harden to PROD (API=$API, ACC=$ACC)"
line

# 1) สร้าง/อัปเดต override เพื่อปิด DEV BYPASS
if [ ! -f docker-compose.override.yml ]; then
  cat > docker-compose.override.yml <<'YML'
services:
  backend:
    environment:
      - ALLOW_DEV_OPEN=0
YML
  echo "✓ created docker-compose.override.yml (ALLOW_DEV_OPEN=0)"
else
  if grep -q 'ALLOW_DEV_OPEN' docker-compose.override.yml; then
    sed -i.bak -E 's/ALLOW_DEV_OPEN\s*=\s*[0-9]+/ALLOW_DEV_OPEN=0/g' docker-compose.override.yml
  else
    awk '
      BEGIN{done=0}
      /^  backend:/ {print; backend=1; next}
      backend && /^(\s*)environment:/ {print; print "      - ALLOW_DEV_OPEN=0"; backend=0; done=1; next}
      {print}
      END{
        if(!done){
          print "services:"; print "  backend:"; print "    environment:"; print "      - ALLOW_DEV_OPEN=0"
        }
      }
    ' docker-compose.override.yml > .tmp.override && mv .tmp.override docker-compose.override.yml
  fi
  echo "✓ updated docker-compose.override.yml (ALLOW_DEV_OPEN=0)"
fi

# 2) รีบิลด์/รีสตาร์ท backend
line; echo "▶ Rebuild & restart backend"
docker compose up -d --build backend >/dev/null

# 3) รอ health 200
echo -n "waiting for backend health"
for i in {1..30}; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$API/api/health" || true)
  if [ "$code" = "200" ]; then echo " -> OK"; break; fi
  echo -n "."
  sleep 1
  [ "$i" = "30" ] && { echo " -> timeout"; exit 1; }
done

# 4) ล็อกอิน → token (แก้การอ่าน JSON ให้ชัวร์)
line; echo "▶ Login (real auth)"
JSON=$(curl -sS -H 'Content-Type: application/json' \
  -d "{\"username\":\"$ACC\",\"password\":\"$PASS\"}" \
  "$API/api/auth/login" || true)
echo "login json: $JSON"

TOKEN=$(
python3 -c 'import sys,json
try:
    d=json.loads(sys.stdin.read() or "{}")
    print(d.get("access_token") or d.get("token") or d.get("jwt") or (d.get("data") or {}).get("access_token") or "")
except Exception:
    print("")' <<<"$JSON"
)

if [ -z "${TOKEN}" ]; then
  echo "❌ no access_token returned (check credentials / response above)"
  exit 1
fi
echo "TOKEN: ${TOKEN:0:12}..."

# 5) sanity: /api/auth/me (ต้อง 200)
code=$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $TOKEN" "$API/api/auth/me" || true)
echo "/api/auth/me -> $code"
[ "$code" = "200" ] || { echo "❌ auth/me failed (want 200)"; exit 1; }

# 6) ทดสอบ products ด้วยโทเค็นจริง
line; echo "▶ Test products with real token"

# upsert
curl -iS -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"sku":"'"$SKU"'","name":"CLI Test Product","unit":"EA","team_code":"STD","group_code":"CHEM-REF","group_name":"Chem Ref","is_domestic":true,"group_tag":"ORG-LOCAL"}' \
  "$API/api/products/upsert" || true

# get
curl -iS -H "Authorization: Bearer $TOKEN" \
  "$API/api/products/get?sku=$SKU" || true

# list
curl -iS -H "Authorization: Bearer $TOKEN" \
  "$API/api/products/list?q=CLI%20Test&limit=5&offset=0" || true

line
echo "✅ Hardened. DEV bypass disabled (ALLOW_DEV_OPEN=0)."
echo "Note:"
echo " - ถ้า upsert ได้ 403 ให้เพิ่ม role admin/superadmin ให้ผู้ใช้ ACC=$ACC"
echo " - ถ้า 401/\"auth unavailable\" ให้ตรวจสอบ dependency ใน app/routers/auth.py"
