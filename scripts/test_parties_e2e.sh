#!/usr/bin/env bash
set -euo pipefail
API="${API:-http://127.0.0.1:8888}"
ACC="${ACC:-admin}"
PASS="${PASS:-admin}"
CUST="${CUST:-CUST-CLI-001}"
VEND="${VEND:-VEND-CLI-001}"

echo "🔑 login $ACC @ $API"
TOKEN=$(curl -sS -H 'Content-Type: application/json' \
  -d '{"username":"'"$ACC"'","password":"'"$PASS"'"}' \
  "$API/api/auth/login" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("access_token",""))')
test -n "$TOKEN" || { echo "login failed"; exit 1; }

echo "👤 me"
curl -fsS -H "Authorization: Bearer $TOKEN" "$API/api/auth/me" >/dev/null && echo "OK"

echo "📦 upsert customer"
curl -fsS -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"code":"'"$CUST"'","name":"CLI Customer","team_code":"STD","group_code":"ORG-LOCAL","group_name":"ลูกค้าในประเทศ","is_active":true}' \
  "$API/api/customers/upsert" | jq .

echo "🔎 get customer"
curl -fsS -H "Authorization: Bearer $TOKEN" \
  "$API/api/customers/get?code=$CUST" | jq .

echo "📦 upsert vendor"
curl -fsS -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"code":"'"$VEND"'","name":"CLI Vendor","team_code":"STD","group_code":"CHEM-REF","group_name":"คู่ค้าเคมี","is_active":true}' \
  "$API/api/vendors/upsert" | jq .

echo "🔎 get vendor"
curl -fsS -H "Authorization: Bearer $TOKEN" \
  "$API/api/vendors/get?code=$VEND" | jq .

echo "📃 list customers/vendors"
curl -fsS -H "Authorization: Bearer $TOKEN" "$API/api/customers/list?limit=5&offset=0" | jq .
curl -fsS -H "Authorization: Bearer $TOKEN" "$API/api/vendors/list?limit=5&offset=0" | jq .

echo "✅ done"

