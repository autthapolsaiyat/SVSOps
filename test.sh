#!/usr/bin/env bash
set -euo pipefail

API_BASE="${API_BASE:-http://localhost:8080/api}"
USERNAME="${USERNAME:-admin}"
PASSWORD="${PASSWORD:-admin}"
TEAM_ID="${TEAM_ID:-e29e7da3-ecae-4184-a1dd-82320c918692}"

SKU="${SKU:-T-001}"
NAME="${NAME:-Test 001}"
UNIT="${UNIT:-EA}"
PRICE="${PRICE:-0}"

G="\033[1;32m"; Y="\033[1;33m"; R="\033[1;31m"; N="\033[0m"
say(){ echo -e "${Y}# $*${N}"; }
ok(){  echo -e "${G}✓ $*${N}"; }
fail(){ echo -e "${R}✗ $*${N}" >&2; exit 1; }

req(){
  local method="$1"; shift
  local url="$1"; shift
  local body="${1:-}"; shift || true

  if [[ -n "$body" ]]; then
    resp=$(curl -sS -D /tmp/h -w '\n%{http_code}' -X "$method" "$url" \
      -H "Authorization: Bearer $TOKEN" "$@" \
      -H 'Content-Type: application/json' \
      -d "$body")
  else
    resp=$(curl -sS -D /tmp/h -w '\n%{http_code}' -X "$method" "$url" \
      -H "Authorization: Bearer $TOKEN" "$@")
  fi
  code="${resp##*$'\n'}"
  body="${resp%$'\n'$code}"

  echo -e "${Y}>> $method $url${N}"
  echo -e "${Y}>> headers:${N}"; sed 's/^/   /' /tmp/h
  echo -e "${Y}>> body:${N}"; echo "$body" | sed 's/^/   /'
  echo "$code"
}

command -v jq >/dev/null || fail "ต้องติดตั้ง jq ก่อน (brew install jq)"

say "API_BASE = $API_BASE"
say "USERNAME = $USERNAME"
say "TEAM_ID  = $TEAM_ID"
echo

say "1) Login"
LOGIN_JSON=$(curl -sf -X POST "$API_BASE/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}")
TOKEN=$(echo "$LOGIN_JSON" | jq -r .access_token)
[[ -n "$TOKEN" && "$TOKEN" != "null" ]] || fail "login ล้มเหลว: $LOGIN_JSON"
ok "ได้ token แล้ว"

say "2) Upsert (insert) — ลอง endpoint ใหม่ /products/upsert ก่อน"
UPSERT_BODY=$(jq -n --arg sku "$SKU" --arg name "$NAME" --arg unit "$UNIT" --argjson price "$PRICE" \
  '{sku:$sku, name:$name, unit:$unit, price_ex_vat:$price}')
code=$(req POST "$API_BASE/products/upsert" "$UPSERT_BODY" -H "X-Team-Id: $TEAM_ID")

if [[ "$code" == "404" || "$code" == "405" ]]; then
  say "   /products/upsert ใช้ไม่ได้ → fallback ไป /products?on_conflict=upsert"
  code=$(req POST "$API_BASE/products?on_conflict=upsert" "$UPSERT_BODY")
fi

[[ "$code" =~ ^2 ]] || fail "upsert ล้มเหลว (HTTP $code)"

say "3) GET by SKU"
code=$(req GET "$API_BASE/products/get?sku=$SKU" "")
[[ "$code" =~ ^2 ]] || fail "get ล้มเหลว (HTTP $code)"

say "4) Upsert (update)"
NEW_NAME="${NEW_NAME:-$NAME (edited)}"
UPSERT_UPDATE_BODY=$(jq -n --arg sku "$SKU" --arg name "$NEW_NAME" '{sku:$sku, name:$name}')
code=$(req POST "$API_BASE/products/upsert" "$UPSERT_UPDATE_BODY" -H "X-Team-Id: $TEAM_ID")
if [[ "$code" == "404" || "$code" == "405" ]]; then
  code=$(req POST "$API_BASE/products?on_conflict=upsert" "$UPSERT_UPDATE_BODY")
fi
[[ "$code" =~ ^2 ]] || fail "update ล้มเหลว (HTTP $code)"

say "5) GET ยืนยัน"
code=$(req GET "$API_BASE/products/get?sku=$SKU" "")
[[ "$code" =~ ^2 ]] || fail "get (after update) ล้มเหลว (HTTP $code)"

say "6) LIST"
code=$(req GET "$API_BASE/products?q=$SKU&page=1&per_page=10" "")
[[ "$code" =~ ^2 ]] || fail "list ล้มเหลว (HTTP $code)"

echo
ok "ทั้งหมดผ่านเรียบร้อย 🎉"

