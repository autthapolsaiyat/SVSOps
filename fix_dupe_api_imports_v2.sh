#!/usr/bin/env bash
set -euo pipefail

PAGES="frontend/src/pages"

backup_once () {
  local f="$1"
  local b="$f.bak-dupe-$(date +%Y%m%d%H%M%S)"
  [[ -f "$f" ]] && cp -n "$f" "$b" 2>/dev/null || true
}

sed_inplace () {
  # BSD/macOS vs GNU
  if sed --version >/dev/null 2>&1; then sed -i "$@"; else sed -i '' "$@"; fi
}

fix_file () {
  local file="$1"
  local names="$2"

  if [[ ! -f "$file" ]]; then
    echo "[SKIP] $file (not found)"; return 0
  fi

  backup_once "$file"

  # 1) ลบทุกบรรทัด import จาก api.client
  sed_inplace "/@\\/lib\\/api\\.client/d" "$file"

  # 2) ลบเศษบรรทัด import ที่ไม่มี 'from' (พวก multi-line ที่เหลือครึ่งเดียว)
  #   - เฉพาะบรรทัดที่ขึ้นต้นด้วย import และมี '{' แต่ไม่มี 'from'
  sed_inplace '/^[[:space:]]*import[[:space:]]*{[^}]*$/d' "$file"
  sed_inplace '/^[[:space:]]*import[[:space:]]*{[^}]*[^f]*$/d' "$file"
  sed_inplace '/^[[:space:]]*import[[:space:]]*{[^}]*$/d' "$file"

  # 3) แทรก import เดียวที่บรรทัดแรก
  #    (ถ้ามี import อื่น ๆ อยู่ก็ไม่เป็นไร; import ของเราจะอยู่บนสุด)
  { echo "import { ${names} } from \"@/lib/api.client\";"; cat "$file"; } > "$file.tmp" \
    && mv "$file.tmp" "$file"

  echo "[OK] fixed $file"
}

fix_file "$PAGES/RolesPage.tsx"    "rolesList, rolesCreate, rolesUpdate, rolesDelete, rolesSetPerms, permsList, type RoleRow"
fix_file "$PAGES/SessionsPage.tsx" "listSessions, revokeSession, logoutApi"

echo "Done."
