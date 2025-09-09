#!/usr/bin/env bash
set -euo pipefail

PAGES="frontend/src/pages"

backup_once () {
  local f="$1"
  local tag="$(date +%Y%m%d%H%M%S)"
  [[ -f "$f" ]] && cp -n "$f" "$f.bak-dupe-$tag" 2>/dev/null || true
}

fix_file () {
  local file="$1"
  local names="$2"     # e.g. "rolesList, rolesCreate, ... , type RoleRow"

  if [[ ! -f "$file" ]]; then
    echo "[SKIP] $file (not found)"
    return 0
  fi

  backup_once "$file"

  # สร้างไฟล์ใหม่: แทรก import เดียวที่ถูกต้อง แล้วต่อด้วยเนื้อหาเดิมที่ลบบรรทัด import เก่าออก
  {
    echo "import { ${names} } from \"@/lib/api.client\";"
    # ลบทุกรายการที่มี '@/lib/api.client' (จะลบเฉพาะบรรทัด import เดิม)
    grep -v '@/lib/api.client' "$file"
  } > "$file.tmp"

  mv "$file.tmp" "$file"
  echo "[OK] fixed $file"
}

# แก้ RolesPage.tsx (เหลือ import เดียว)
fix_file "$PAGES/RolesPage.tsx" "rolesList, rolesCreate, rolesUpdate, rolesDelete, rolesSetPerms, permsList, type RoleRow"

# แก้ SessionsPage.tsx (เหลือ import เดียว)
fix_file "$PAGES/SessionsPage.tsx" "listSessions, revokeSession, logoutApi"

echo "Done."
