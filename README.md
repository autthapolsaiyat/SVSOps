README_EOF

--- test_products_e2e.sh ---

cat > test_products_e2e.sh <<'E2E_EOF'
#!/usr/bin/env bash
set -euo pipefail
API="${API:-http://127.0.0.1:8888}
"
ACC="${ACC:-admin}"
PASS="${PASS:-admin}"
SKU="${SKU:-CLI-TEST-001}"
line(){ printf '\n%s\n' "────────────────────────────────────────────────────────"; }
call(){ local m="$1" u="$2" d="${3-}"; line; echo "▶ $m $API$u"; [ -n "${d-}" ] && echo "payload: $d";
if [ -n "${d-}" ]; then curl -iS -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -X "$m" -d "$d" "$API$u" || true
else curl -iS -H "Authorization: Bearer $TOKEN" -X "$m" "$API$u" || true; fi; }

echo "SVS-Ops Products E2E (API=$API, ACC=$ACC, SKU=$SKU)"; line
curl -fsS "$API/api/health" >/dev/null && echo "health OK" || { echo "health FAIL"; exit 1; }
LOGIN_JSON="$(curl -sS -H 'Content-Type: application/json' -d '{"username":"'"$ACC"'","password":"'"$PASS"'"}' "$API/api/auth/login")"
TOKEN="$(python3 - <<'PY' "$LOGIN_JSON"
import sys,json; d=json.loads(sys.argv[1]); print(d.get('access_token') or d.get('token') or (d.get('data') or {}).get('access_token') or '')
PY
)"
[ -n "$TOKEN" ] || { echo "login failed"; exit 1; }
curl -fsS -H "Authorization: Bearer $TOKEN" "$API/api/auth/me" >/dev/null && echo "me OK"
call POST /api/products/upsert '{
"sku":"'"$SKU"'","name":"CLI Test Product","unit":"EA",
"team_code":"STD","group_code":"CHEM-REF","group_name":"Chem Ref",
"is_domestic":true,"group_tag":"ORG-LOCAL"
}'
call GET "/api/products/get?sku=$SKU"
call GET "/api/products/list?q=CLI%20Test&limit=5&offset=0"
call POST /api/products/upsert '{
"sku":"'"$SKU"'","name":"CLI Test Product (edited)","unit":"EA",
"team_code":"STD","group_code":"CHEM-REF","group_name":"Chem Ref",
"is_domestic":false,"group_tag":"ORG-LOCAL"
}'
call GET "/api/products/get?sku=$SKU"
call POST /api/products/active '{"sku":"'"$SKU"'","is_active":false}'
call POST /api/products/active '{"sku":"'"$SKU"'","is_active":true}'
call GET /api/products/teams
call GET /api/products/groups
call GET "/api/products/list?origin=domestic&limit=5"
call GET "/api/products/list?origin=foreign&limit=5"
echo "✅ Done."
E2E_EOF

--- snapshot script ---

mkdir -p scripts
cat > scripts/make_phase2_1_snapshot.sh <<'SNAP_EOF'
#!/usr/bin/env bash
set -euo pipefail
PHASE="phase2.1"
TS="$(date +%Y%m%d-%H%M%S)"
OUT="artifacts/${PHASE}-${TS}"
API="${API:-http://127.0.0.1:8888}
"
ACC="${ACC:-admin}"
PASS="${PASS:-admin}"

echo "== SVS-Ops snapshot ${PHASE} =="
mkdir -p "$OUT/logs" "$OUT/meta"

if curl -fsS "${API}/api/health" >/dev/null; then echo "health OK"; else echo "health FAIL" >&2; fi

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || { echo "Not a git repo"; exit 1; }
{
echo "# git meta"
echo "branch: $(git rev-parse --abbrev-ref HEAD)"
echo "commit: $(git rev-parse HEAD)"
echo "status:"; git status -sb
} > "$OUT/meta/git.txt"

git ls-files -z > "$OUT/meta/GIT_FILES.zlist"
if command -v sha256sum >/dev/null 2>&1; then
xargs -0 sha256sum < "$OUT/meta/GIT_FILES.zlist" > "$OUT/MANIFEST.sha256"
else
xargs -0 shasum -a 256 < "$OUT/meta/GIT_FILES.zlist" > "$OUT/MANIFEST.sha256"
fi

docker compose images > "$OUT/meta/compose_images.txt" || true
docker image inspect svs-ops-backend:latest --format '{{.Id}} {{.RepoTags}} {{.RepoDigests}}' > "$OUT/meta/backend_image.txt" 2>/dev/null || true

docker compose exec -T backend sh -lc "python - <<'PY'
from app.main import app
for r in app.routes:
p=getattr(r,'path',None); ms=getattr(r,'methods',[])
if p and p.startswith('/api/'):
print(p, sorted([m for m in ms if m!='HEAD']))
PY" > "$OUT/routes.txt" || true
curl -fsS "${API}/api/openapi.json" -o "$OUT/openapi.json" || true

for svc in svs-db db; do
if docker compose exec -T "$svc" true 2>/dev/null; then
docker compose exec -T "$svc" sh -lc 'pg_dump -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-postgres}"' > "$OUT/db_dump.sql" && break || true
fi
done

LOG="$OUT/logs/products_e2e.txt"
ACC="$ACC" PASS="$PASS" ./test_products_e2e.sh 2>&1 | sed -E 's/eyJ[0-9A-Za-z_-]+(.[0-9A-Za-z_-]+){1,2}/TOKEN /g' | tee "$LOG" >/dev/null || true

for f in docker-compose.yml docker-compose.override.yml; do
[ -f "$f" ] && cp "$f" "$OUT/" || true
done

echo "== Summary ==" | tee "$OUT/SUMMARY.txt"
printf "MANIFEST entries: %s\n" "$(wc -l < "$OUT/MANIFEST.sha256")" | tee -a "$OUT/SUMMARY.txt"
printf "Routes: %s\n" "$(grep -c '^/api/' "$OUT/routes.txt" 2>/dev/null || echo 0)" | tee -a "$OUT/SUMMARY.txt"
printf "OpenAPI: %s bytes\n" "$(wc -c < "$OUT/openapi.json" 2>/dev/null || echo 0)" | tee -a "$OUT/SUMMARY.txt"
[ -s "$OUT/db_dump.sql" ] && echo "DB dump: present" | tee -a "$OUT/SUMMARY.txt" || echo "DB dump: (skipped/failed)" | tee -a "$OUT/SUMMARY.txt"

git add README.md test_products_e2e.sh scripts/make_phase2_1_snapshot.sh "$OUT" || true
git commit -m "${PHASE}: snapshot, products stable, artifacts added" || true
git tag -f -a "${PHASE}" -m "${PHASE} snapshot @ ${TS}" || true

echo "Snapshot ready at: $OUT"
echo "Next: git push --follow-tags"
SNAP_EOF

chmod +x test_products_e2e.sh scripts/make_phase2_1_snapshot.sh
echo "✅ created README.md and scripts."
SH
chmod +x phase2_1_setup.sh
./phase2_1_setup.sh
