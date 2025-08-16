#!/usr/bin/env bash
set -euo pipefail

BASE="http://localhost:8888/api"

echo "== health, ready, openapi =="
curl -sS "$BASE/health" | jq .
curl -sS "$BASE/ready"  | jq .
if curl -fsS "$BASE/openapi.json" >/dev/null; then echo "openapi: ok"; else echo "openapi: missing"; fi

echo "== login =="
TOKEN=$(curl -sS -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  --data-raw '{"username":"admin","password":"pass"}' | jq -r .access_token)
echo "TOKEN: ${TOKEN:0:18}..."

echo "== me =="
curl -sS -H "Authorization: Bearer $TOKEN" "$BASE/auth/me" | jq .

echo "== sample receive (POST) =="
curl -sS -X POST "$BASE/inventory/receive" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"sku":"SKU-001","wh":"WH-A","qty":1,"unit_cost":100,"ref":"GR-TEST"}' | jq .

echo "== logout & verify =="
curl -sS -X POST -H "Authorization: Bearer $TOKEN" "$BASE/auth/logout" | jq .

HTTP_CODE=$(curl -sS -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" "$BASE/auth/me")
echo "reusing token http_code=$HTTP_CODE (should be 401)"

