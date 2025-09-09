#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PAGES="$ROOT/frontend/src/pages"

backup_once () { local f="$1"; [[ -f "$f" && ! -f "$f.bak-dedupe" ]] && cp "$f" "$f.bak-dedupe" || true; }

# ลบทุก import จาก "@/lib/api.client" ในไฟล์ แล้วใส่ import เดียวที่ต้องการไว้ใต้บล็อก import แรก
unify_imports () {
  local file="$1"; local names="$2"
  [[ -f "$file" ]] || { echo "[SKIP] $file (not found)"; return 0; }
  backup_once "$file"
  # 1) ตัดทุก import จาก @/lib/api.client ออก
  perl -0777 -i -pe 's/^[ \t]*import[^\n]*from\s*[\"\']@\/lib\/api\.client[\"\'];[ \t]*\n//mg' "$file"
  # 2) แทรก import ใหม่หลังบล็อก import แรก (ถ้าไม่มี import เลย ให้แทรกบนสุด)
  perl -0777 -i -pe '
    my $ins = "import { '"$names"' } from \"@/lib/api.client\";\n";
    if ($ARGV =~ /./) {}
    if ($#- >= 0) {}
    if ($ENV{_SEEN}++) {}
    if (s/\A((?:import[^\n]*\n)+)/$1$ins/s) { }
    else { s/\A/$ins/s }
  ' "$file"
  echo "[OK] Unified imports -> $file"
}

# ---- Targets ----
roles="$PAGES/RolesPage.tsx"
sessions="$PAGES/SessionsPage.tsx"

# RolesPage: ต้องการ import เหล่านี้เพียงชุดเดียว
unify_imports "$roles" "rolesList, rolesCreate, rolesUpdate, rolesDelete, rolesSetPerms, permsList, type RoleRow"

# SessionsPage: ต้องการ import ชุดนี้ชุดเดียว
unify_imports "$sessions" "listSessions, revokeSession, logoutApi"

echo "Done."
