#!/usr/bin/env bash
set -euo pipefail
API="${API:-http://localhost:8080/api}"
TEAM_ID="${TEAM_ID:-e29e7da3-ecae-4184-a1dd-82320c918692}"
PASS="${PASS:-admin@1234}"
login(){ local u="$1"; TOKEN=$(curl -s -X POST "$API/auth/login" -H "Content-Type: application/json" -d "{\"username\":\"$u\",\"password\":\"$PASS\"}" | jq -r .access_token); [[ -n "$TOKEN" && "$TOKEN" != null ]] || { echo "login $u failed"; return 1; }; }
role(){ local u="$1"; echo "== $u =="; login "$u"; curl -s -o /dev/null -w "LIST   -> %{http_code}\n" "$API/products/" -H "Authorization: Bearer $TOKEN"; local sku="RBAC-$u-$(date +%s)"; curl -s -o /dev/null -w "CREATE -> %{http_code}\n" -X POST "$API/products/?on_conflict=upsert" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" --data-binary "{\"sku\":\"$sku\",\"name\":\"$u\",\"unit\":\"ชิ้น\",\"price_ex_vat\":111,\"team_id\":\"$TEAM_ID\"}"; }
role sysop
role whmgr
role whop
role sales
role importer
role reporter
role approver
