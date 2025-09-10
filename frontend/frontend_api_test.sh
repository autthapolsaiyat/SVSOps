#!/usr/bin/env bash
set -euo pipefail

# ===== Config ที่แก้ได้ตามต้องการ =====
API_BASE="${API_BASE:-http://localhost:8080/api}"   # จะยิงตรง backend
USER="${USER_NAME:-admin}"
PASS="${USER_PASS:-admin}"
TEAM_ID="${TEAM_ID:-e29e7da3-ecae-4184-a1dd-82320c918692}"

# ค่า test (แทนแบบฟอร์ม /products/new)
SKU="${SKU:-F-TERM-001}"
NAME="${NAME:-Terminal Probe}"
UNIT="${UNIT:-EA}"
PRICE="${PRICE:-50}"

# ===== Helpers =====
say() { printf "%b\n" "$*"; }
hr()  { printf '%*s\n' "${COLUMNS:-80}" '' | tr ' ' -; }

fail() { say "✗ $*"; exit 1; }
ok()   { say "✓ $*"; }

jqc()  { jq -r "$1" 2>/dev/null || true; }

# ===== 0) ping backend =====
say "# API_BASE = $API_BASE"
say "# USER     = $USER"
say "# TEAM_ID  = $TEAM_ID"
hr
say "# 0) /ready"
curl -fsS "$API_BASE/ready" | jq . >/dev/null || fail "/ready ไม่ตอบ OK"
ok "ready"

# ===== 1) Login =====
hr
say "# 1) Login"
TOKEN="$(
  curl -fsS -X POST "$API_BASE/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"$USER\",\"password\":\"$PASS\"}" | jq -r .access_token
)" || fail "login ล้มเหลว"
[ -n "$TOKEN" ] || fail "ไม่ได้ access_token"
ok "ได้ token แล้ว"

# ===== 2) ดึง master (ทีม / กลุ่ม) =====
hr
say "# 2) Masters"
say "## teams"
curl -fsS "$API_BASE/products/teams" -H "Authorization: Bearer $TOKEN" | jq .
say "## groups"
curl -fsS "$API_BASE/products/groups" -H "Authorization: Bearer $TOKEN" | jq . || true

# ===== 3) Upsert (INSERT) — จำลองกดบันทึกจากฟอร์ม =====
hr
say "# 3) Upsert (insert) SKU=$SKU"
UPS_RES="$(
  curl -fsS -X POST "$API_BASE/products/upsert" \
    -H "Authorization: Bearer $TOKEN" \
    -H "X-Team-Id: $TEAM_ID" \
    -H "Content-Type: application/json" \
    -d "{\"sku\":\"$SKU\",\"name\":\"$NAME\",\"unit\":\"$UNIT\",\"price_ex_vat\":$PRICE}"
)" || fail "upsert (insert) ล้มเหลว"
echo "$UPS_RES" | jq .
RID="$(echo "$UPS_RES" | jq -r .id)"
[ -n "$RID" ] || fail "upsert ไม่ได้ id"
ok "insert สำเร็จ (id=$RID)"

# ===== 4) GET by SKU (ตรวจว่าขึ้นจริง) =====
hr
say "# 4) GET /products/get?sku=$SKU"
GET_RES="$(
  curl -fsS "$API_BASE/products/get?sku=$SKU" \
    -H "Authorization: Bearer $TOKEN"
)" || fail "get by sku ล้มเหลว"
echo "$GET_RES" | jq .
GSKU="$(echo "$GET_RES" | jq -r .sku)"
[ "$GSKU" = "$SKU" ] || fail "sku ไม่ตรง ควรเป็น $SKU แต่ได้ $GSKU"
ok "อ่านคืนได้ (sku=$GSKU)"

# ===== 5) Upsert (UPDATE) — จำลองแก้ไขแล้วบันทึก =====
hr
say "# 5) Upsert (update) — เปลี่ยนชื่อ"
NEW_NAME="${NEW_NAME:-$NAME (edited)}"
UPS2="$(
  curl -fsS -X POST "$API_BASE/products/upsert" \
    -H "Authorization: Bearer $TOKEN" \
    -H "X-Team-Id: $TEAM_ID" \
    -H "Content-Type: application/json" \
    -d "{\"sku\":\"$SKU\",\"name\":\"$NEW_NAME\",\"unit\":\"$UNIT\",\"price_ex_vat\":$PRICE}"
)" || fail "upsert (update) ล้มเหลว"
echo "$UPS2" | jq .
ok "update สำเร็จ"

say
ok "เสร็จสิ้น 🎉 (SKU=$SKU)"

