\
  #!/usr/bin/env bash
  set -euo pipefail

  API="${API:-http://localhost:8080/api}"
  USER="${LOGIN_USER:-sysop}"
  PASS="${LOGIN_PASS:-admin}"

  req() {  # method path [json-body]
    local M="$1" P="$2" B="${3:-}"
    if [[ -n "$B" ]]; then
      curl -sS -X "$M" "$API$P" -H "Authorization: Bearer $T" \
           -H "Content-Type: application/json" -d "$B" -w '  ← %{http_code}\n'
    else
      curl -sS -X "$M" "$API$P" -H "Authorization: Bearer $T" -w '  ← %{http_code}\n'
    fi
  }

  login() {
    echo "→ login as $USER"
    T=$(curl -sS -X POST "$API/auth/login" -H 'Content-Type: application/json' \
         -d "{\"username\":\"$USER\",\"password\":\"$PASS\"}" | jq -r .access_token)
    [[ -n "${T:-}" && "$T" != "null" ]] || { echo "LOGIN FAILED"; exit 1; }
    echo "✓ token ok"
  }

  probe_dashboard() {
    echo "== Dashboard ==" 
    echo "GET /dashboard/summary";            req GET /dashboard/summary
    echo "GET /dashboard/timeseries?days=14"; req GET "/dashboard/timeseries?days=14"
    echo "GET /dashboard/stock";              req GET /dashboard/stock || true
  }

  probe_products()     { echo "== Products ==";     req GET "/products?per_page=10"; }
  probe_customers()    { echo "== Customers ==";    req GET "/customers?per_page=10" || true; }
  probe_quotations()   { echo "== Quotations ==";   req GET "/sales/quotations?per_page=10"; }
  probe_pos()          { echo "== Purchases ==";    req GET "/purchases?per_page=10" || true; }
  probe_sos()          { echo "== Sales Orders =="; req GET "/sales-orders?per_page=10" || true; }
  probe_inventory()    { echo "== Inventory (sample POST) =="; req POST /inventory/receive \
                           "{\"moves\":[{\"sku\":\"SAMPLE\",\"qty\":1,\"unit\":\"EA\"}]}" || true; }
  probe_salesreps()    { echo "== Sales Reps ==";   req GET "/sales/quotations/sales-reps" || true; }
  probe_reports()      { echo "== Reports ==";      req GET /reports || true; }
  probe_admin() {
    echo "== Admin ==" 
    echo "GET /admin/users"; req GET /admin/users
    echo "GET /admin/roles"; req GET /admin/roles
    echo "GET /admin/perms"; req GET /admin/perms
    echo "GET /auth/sessions"; req GET /auth/sessions
  }
  probe_me_settings()  { echo "== Me / Settings =="; req GET /auth/me; }

  run_all() {
    probe_dashboard; probe_products; probe_customers; probe_quotations
    probe_pos; probe_sos; probe_inventory; probe_salesreps
    probe_reports; probe_admin; probe_me_settings
  }

  command -v jq >/dev/null || { echo "กรุณาติดตั้ง jq ก่อน (brew install jq)"; exit 1; }
  login

  case "${1:-all}" in
    dashboard)  probe_dashboard ;;
    products)   probe_products  ;;
    customers)  probe_customers ;;
    quotations) probe_quotations ;;
    pos)        probe_pos ;;
    sos)        probe_sos ;;
    inventory)  probe_inventory ;;
    salesreps)  probe_salesreps ;;
    reports)    probe_reports ;;
    admin)      probe_admin ;;
    me)         probe_me_settings ;;
    all)        run_all ;;
    *) echo "usage: API=... LOGIN_USER=... LOGIN_PASS=... bash debug_pages.sh [dashboard|products|customers|quotations|pos|sos|inventory|salesreps|reports|admin|me|all]"; exit 1 ;;
  esac
