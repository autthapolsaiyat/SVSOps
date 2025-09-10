#!/usr/bin/env bash
set -euo pipefail

# === CONFIG (ปรับได้ผ่าน env) ===
API="${API:-http://127.0.0.1:8888}"
ACC="${ACC:-admin}"
PASS="${PASS:-admin}"
SKU="${SKU:-CLI-TEST-001}"
JAR="${JAR:-.svs.cookies}"

line(){ printf '\n%s\n' "────────────────────────────────────────────────────────"; }
call(){ # call METHOD PATH [JSON]
  local m="$1"; shift
  local u="$1"; shift
  local data="${1-}"
  line; echo "▶ $m $API$u"
  [ -n "$data" ] && echo "payload: $data"
  if [ -n "$data" ]; then
    if [ -n "${TOKEN-}" ]; then
      curl -iS -b "$JAR" -c "$JAR" -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" -X "$m" -d "$data" "$API$u" || true
    else
      curl -iS -b "$JAR" -c "$JAR" -H 'Content-Type: application/json' -X "$m" -d "$data" "$API$u" || true
    fi
  else
    if [ -n "${TOKEN-}" ]; then
      curl -iS -b "$JAR" -c "$JAR" -H "Authorization: Bearer $TOKEN" -X "$m" "$API$u" || true
    else
      curl -iS -b "$JAR" -c "$JAR" -X "$m" "$API$u" || true
    fi
  fi
}

echo "SVS-Ops Products E2E (API=$API, ACC=$ACC, SKU=$SKU)"
line

# 0) Health
call GET /api/health

# 1) Login → รับ token
line; echo "▶ POST $API/api/auth/login (login & capture token)"
LOGIN_JSON="$(curl -sS -c "$JAR" -H 'Content-Type: application/json' \
  -d '{"username":"'"$ACC"'","password":"'"$PASS"'"}' "$API/api/auth/login" || true)"
echo "$LOGIN_JSON"

# ✅ จับ token ด้วย python3 -c (อ่าน JSON จาก argv แทน stdin)
TOKEN="$(python3 -c 'import sys,json; d=json.loads(sys.argv[1]); print(d.get("access_token") or d.get("token") or d.get("jwt") or (d.get("data") or {}).get("access_token") or "")' "$LOGIN_JSON" 2>/dev/null || true)"

if [ -n "$TOKEN" ]; then
  echo "TOKEN=*** captured"
else
  echo "!! no token captured — will try cookie session"
fi

# ตรวจสอบสิทธิ์
ME_STATUS="$(
  if [ -n "${TOKEN-}" ]; then
    curl -sS -o /dev/null -w '%{http_code}' -b "$JAR" -H "Authorization: Bearer $TOKEN" "$API/api/auth/me" || true
  else
    curl -sS -o /dev/null -w '%{http_code}' -b "$JAR" "$API/api/auth/me" || true
  fi
)"
echo "/api/auth/me -> $ME_STATUS"
if [ "$ME_STATUS" != "200" ]; then
  echo "ERROR: login failed (ตั้งค่า ACC/PASS ให้ถูกต้อง เช่น ACC=admin PASS=admin)"
  exit 1
fi

# ---------- PRODUCTS ----------
# 2) Upsert (สร้าง/อัปเดต)
call POST /api/products/upsert '{
  "sku":"'"$SKU"'",
  "name":"CLI Test Product",
  "unit":"EA",
  "team_code":"STD",
  "group_code":"CHEM-REF",
  "group_name":"Chem Ref",
  "is_domestic":true,
  "group_tag":"ORG-LOCAL"
}'

# 3) Get รายการเดียว
call GET "/api/products/get?sku=$SKU"

# 4) List (ค้นหา)
call GET "/api/products/list?q=CLI%20Test&limit=5&offset=0"

# 5) แก้ไข (upsert อีกครั้ง)
call POST /api/products/upsert '{
  "sku":"'"$SKU"'",
  "name":"CLI Test Product (edited)",
  "unit":"EA",
  "team_code":"STD",
  "group_code":"CHEM-REF",
  "group_name":"Chem Ref",
  "is_domestic":false,
  "group_tag":"ORG-LOCAL"
}'
call GET "/api/products/get?sku=$SKU"

# 6) Toggle active ปิด/เปิด
call POST /api/products/active '{"sku":"'"$SKU"'","is_active":false}'
call POST /api/products/active '{"sku":"'"$SKU"'","is_active":true}'

# 7) Lookups + ฟิลเตอร์ origin
call GET /api/products/teams
call GET /api/products/groups
call GET "/api/products/list?origin=domestic&limit=5"
call GET "/api/products/list?origin=foreign&limit=5"

line
echo "✅ Done."
