#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API="http://localhost:8080/api"

echo "==> Check backend ..."
if ! curl -fsS "$API/ready" >/dev/null 2>&1; then
  docker compose up -d backend
  echo -n "   waiting backend "
  for i in {1..60}; do
    if curl -fsS "$API/ready" >/dev/null 2>&1; then echo "OK"; break; fi
    printf "."; sleep 1
    [[ $i -eq 60 ]] && { echo " FAIL"; exit 1; }
  done
else
  echo "   backend OK"
fi

echo "==> Build & start frontend preview (4173) ..."
cd "$ROOT/frontend"

# build เงียบ ๆ (ถ้าบิลด์ผ่านอยู่แล้ว ไม่มีผล)
VITE_API_BASE=$API npm run build >/dev/null 2>&1 || true

# เปิด preview แบบ background ถ้ายังไม่มีใครฟังที่ 4173
if ! lsof -iTCP:4173 -sTCP:LISTEN >/dev/null 2>&1; then
  nohup env VITE_API_BASE=$API npm run preview >/tmp/svs_preview.log 2>&1 &
  echo "   preview starting (log: /tmp/svs_preview.log)"
fi

# รอให้พอร์ต 4173 ตอบ
for i in {1..40}; do
  if curl -fsS http://localhost:4173 >/dev/null 2>&1; then
    echo "   preview ready at http://localhost:4173"; break
  fi
  sleep 0.5
  [[ $i -eq 40 ]] && { echo "   preview not responding"; exit 1; }
done

echo "==> Open tabs in Chrome ..."
osascript -l JavaScript <<'JXA'
var chrome = Application('Google Chrome');
chrome.activate();
if (chrome.windows.length === 0) { chrome.Window().make(); }
var win = chrome.windows[0];
var base = "http://localhost:4173";
var paths = [
  "/dashboard","/me",
  "/products","/customers","/staff-groups",
  "/sales/quotations","/purchases","/sales-orders",
  "/inventory/receive","/inventory/adjust","/inventory/issue","/inventory/transfer",
  "/sales-reps","/reports","/importer",
  "/admin-users","/roles","/permissions","/sessions",
  "/settings","/qr"
];
paths.forEach(function(p){ win.tabs.push(chrome.Tab({ url: base + p })); delay(0.12); });
JXA

echo
echo "Done. Preview running at: http://localhost:4173"
echo "Preview log: /tmp/svs_preview.log   (tail -f /tmp/svs_preview.log)"
