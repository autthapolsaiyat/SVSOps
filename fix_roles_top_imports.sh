#!/usr/bin/env bash
set -euo pipefail

F="frontend/src/pages/RolesPage.tsx"
[[ -f "$F" ]] || { echo "[SKIP] $F not found"; exit 0; }

cp -n "$F" "$F.bak-top-$(date +%Y%m%d%H%M%S)" 2>/dev/null || true

awk '
  BEGIN { imports=""; body="" }
  # เก็บทุก import (เฉพาะบรรทัดที่ขึ้นต้นด้วย import) — กันซ้ำ
  /^[[:space:]]*import[[:space:]]/ {
    line=$0
    if (!seen[line]++) imports = imports line "\n"
    next
  }
  # ลบเศษ type RoleRow เดี่ยว ๆ
  /^[[:space:]]*type[[:space:]]+RoleRow[[:space:]]*;?[[:space:]]*$/ { next }

  { body = body $0 "\n" }
  END {
    printf "%s%s", imports, body
  }
' "$F" > "$F.tmp" && mv "$F.tmp" "$F"

echo "[OK] RolesPage imports normalized -> $F"
