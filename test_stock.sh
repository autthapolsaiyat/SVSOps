#!/usr/bin/env bash
set -euo pipefail

# ==== CONFIG ====
BASE="${BASE:-http://localhost:8080/api}"
ADMIN_USER="${ADMIN_USER:-admin}"
ADMIN_PASS="${ADMIN_PASS:-admin}"

SKU="${SKU:-TEST-STK-001}"
NAME="${NAME:-Stock Test Item}"
UNIT="${UNIT:-EA}"
PRICE="${PRICE:-100.00}"

RCV_QTY="${RCV_QTY:-100}"
RCV_COST="${RCV_COST:-50.00}"
ISSUE_QTY="${ISSUE_QTY:-30}"

# ==== HELPERS ====
curl_j() { curl -fsS "$@"; }
hdr_auth() { echo "Authorization: Bearer ${TOKEN}"; }

section() { echo; echo "====== $* ======"; }
ok() { echo "✅ $*"; }
info() { echo "ℹ️  $*"; }
warn() { echo "⚠️  $*"; }

# ==== 0) HEALTH ====
section "0) Health check"
curl_j -X GET "$BASE/ready" | jq .
ok "Backend ready"

# ==== 1) LOGIN ====
section "1) Login"
TOKEN="$(curl_j -X POST "$BASE/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASS\"}" \
  | jq -r '.access_token')"
[ -n "$TOKEN" ] || { echo "Login failed: no token"; exit 1; }
ok "Got token"

# ==== 1.5) OPENAPI quick scan (optional) ====
section "1.5) OpenAPI quick scan"
OPENAPI_OK=true
if ! curl -fsS "$BASE/openapi.json" >/dev/null; then
  OPENAPI_OK=false; warn "OpenAPI not available (continue anyway)."
else
  COUNT=$(curl -fsS "$BASE/openapi.json" | jq '.paths | keys | length')
  info "paths: $COUNT"
fi
ok "Scan done"

# ==== 2) IMPORT PRODUCT (CSV) ====
section "2) Import product via /import-csv"
TMPCSV="$(mktemp "${TMPDIR:-/tmp}/svsops_products.XXXXXX").csv"
cat > "$TMPCSV" <<EOF
sku,name,unit,price_ex_vat
$SKU,$NAME,$UNIT,$PRICE
EOF

# ลอง /import-csv ก่อน ถ้า 404 ค่อยลอง /import
IMPORT_RES=""
if curl -fsSI -X OPTIONS "$BASE/import-csv" >/dev/null 2>&1; then
  IMPORT_RES="$(curl -fsS -X POST "$BASE/import-csv" \
    -H "$(hdr_auth)" \
    -F "file=@$TMPCSV")"
  echo "$IMPORT_RES" | (jq . 2>/dev/null || cat)
  ok "Imported via /import-csv"
else
  warn "/import-csv not found; try /import"
  IMPORT_RES="$(curl -fsS -X POST "$BASE/import" \
    -H "$(hdr_auth)" \
    -F "file=@$TMPCSV")"
  echo "$IMPORT_RES" | (jq . 2>/dev/null || cat)
  ok "Imported via /import"
fi

# ==== 3) RESOLVE product_id ====
section "3) Resolve product_id for $SKU"

PRODUCT_ID=""
try_suggest () {
  local field="$1"
  local url="$BASE/suggest/$field"
  local res
  res="$(curl -fsS -G "$url" -H "$(hdr_auth)" --data-urlencode "q=$SKU" 2>/dev/null || true)"
  if [[ -n "$res" ]]; then
    # รองรับทั้ง array และ object list ทั่วไป พยายามเดา id จาก key ยอดนิยม
    PRODUCT_ID="$(echo "$res" | jq -r '
      (.[0].id // .items[0].id // .data[0].id // empty) // empty
    ' 2>/dev/null || true)"
    if [[ -n "${PRODUCT_ID:-}" && "$PRODUCT_ID" != "null" ]]; then
      info "Found id via /suggest/$field → $PRODUCT_ID"
      return 0
    fi
  fi
  return 1
}

# ลองหลาย field ยอดนิยม
for F in products product sku name; do
  try_suggest "$F" && break || true
done

# ทางหนีทีไล่: inventory/levels อาจคืนรายการมี product_id ให้ใช้
if [[ -z "${PRODUCT_ID:-}" || "$PRODUCT_ID" == "null" ]]; then
  warn "suggest not returned id; try /inventory/levels"
  LV="$(curl -fsS -G "$BASE/inventory/levels" -H "$(hdr_auth)" --data-urlencode "sku=$SKU" 2>/dev/null || true)"
  PRODUCT_ID="$(echo "$LV" | jq -r '
    (.[0].product_id // .items[0].product_id // .data[0].product_id // empty) // empty
  ' 2>/dev/null || true)"
  if [[ -n "${PRODUCT_ID:-}" && "$PRODUCT_ID" != "null" ]]; then
    info "Found id via inventory/levels → $PRODUCT_ID"
  fi
fi

if [[ -z "${PRODUCT_ID:-}" || "$PRODUCT_ID" == "null" ]]; then
  warn "Cannot resolve product_id; some endpoints below may fail. Continue anyway."
else
  ok "product_id = $PRODUCT_ID"
fi

# ==== 4) RECEIVE ====
section "4) Receive stock"
RCV_PAYLOAD=$(jq -n \
  --arg pid "$PRODUCT_ID" \
  --argjson qty "$RCV_QTY" \
  --arg cost "$RCV_COST" \
  '{
    product_id: ( $pid | select(. != "" and . != "null") ),
    sku: ( $pid | if . == "" or . == "null" then "'"$SKU"'" else empty end ),
    quantity: $qty,
    unit_cost: ($cost|tonumber),
    ref_no: "UT-RECV-001",
    note: "Automated receive test"
  }')

RCV_RES="$(curl_j -X POST "$BASE/inventory/receive" \
  -H "$(hdr_auth)" -H 'Content-Type: application/json' \
  -d "$RCV_PAYLOAD")"
echo "$RCV_RES" | jq .
ok "Received $RCV_QTY @ $RCV_COST"

# ==== 5) ISSUE ====
section "5) Issue stock"
ISSUE_PAYLOAD=$(jq -n \
  --arg pid "$PRODUCT_ID" \
  --argjson qty "$ISSUE_QTY" \
  '{
    product_id: ( $pid | select(. != "" and . != "null") ),
    sku: ( $pid | if . == "" or . == "null" then "'"$SKU"'" else empty end ),
    quantity: $qty,
    ref_no: "UT-ISSUE-001",
    reason: "Automated issue test"
  }')

ISSUE_RES="$(curl_j -X POST "$BASE/inventory/issue" \
  -H "$(hdr_auth)" -H 'Content-Type: application/json' \
  -d "$ISSUE_PAYLOAD")"
echo "$ISSUE_RES" | jq .
ok "Issued $ISSUE_QTY"

# ==== 6) LEVELS / BALANCE ====
section "6) Inventory levels"
LV_QS=( "sku=$SKU" )
[[ -n "${PRODUCT_ID:-}" && "$PRODUCT_ID" != "null" ]] && LV_QS+=( "product_id=$PRODUCT_ID" )

LV_URL="$BASE/inventory/levels"
for qs in "${LV_QS[@]}"; do
  info "GET $LV_URL?$qs"
  curl_j -G "$LV_URL" -H "$(hdr_auth)" --data-urlencode "$qs" | jq .
done
ok "Levels fetched"

# ==== 7) REPORTS (balance & valuation) ====
section "7) Reports"
AS_OF="$(date -u +%Y-%m-%dT23:59:59Z)"
BAL="$(curl_j -G "$BASE/reports/stock/balance" -H "$(hdr_auth)" \
  --data-urlencode "as_of=$AS_OF" \
  --data-urlencode "sku=$SKU" 2>/dev/null || true)"
echo "${BAL:-{}}" | (jq . 2>/dev/null || cat)
ok "Report: balance (as_of=$AS_OF)"

VAL="$(curl_j -G "$BASE/reports/stock/valuation" -H "$(hdr_auth)" \
  --data-urlencode "as_of=$AS_OF" \
  --data-urlencode "sku=$SKU" 2>/dev/null || true)"
echo "${VAL:-{}}" | (jq . 2>/dev/null || cat)
ok "Report: valuation (as_of=$AS_OF)"

echo
ok "ALL STOCK TESTS DONE 🎉"

