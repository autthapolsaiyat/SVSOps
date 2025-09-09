#!/bin/bash
BASE=http://localhost:8080/api
TOKEN=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' \
  | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p')

echo "TOKEN: ${TOKEN:0:20}..."

for url in \
  "$BASE/quotes?page=1&page_size=10" \
  "$BASE/purchase-orders?page=1&page_size=10" \
  "$BASE/inventory/receipts?page=1&page_size=10" \
  "$BASE/sales/orders?page=1&page_size=10" \
  "$BASE/billing/invoices?page=1&page_size=10"
do
  echo -e "\nGET $url"
  curl -fsS "$url" -H "Authorization: Bearer $TOKEN" | jq .
done
