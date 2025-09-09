#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PAGES="$ROOT/frontend/src/pages"

backup_once () { local f="$1"; [[ -f "$f" && ! -f "$f.bak-dedupe" ]] && cp "$f" "$f.bak-dedupe" || true; }

# รวม import จาก "@/lib/api.client" ให้เหลือบรรทัดเดียว พร้อมชื่อที่ต้องการ
unify_imports_file () {
  local file="$1"; local names="$2"; local module='@/lib/api.client'
  [[ -f "$file" ]] || { echo "[SKIP] $file (not found)"; return 0; }
  backup_once "$file"

  awk -v module="$module" -v names="$names" '
    BEGIN{inserted=0; inblock=1; buf=""}
    {
      # ลบทุก import จาก module นี้
      if ($0 ~ /^import / && $0 ~ "from \"" module "\"") next

      # สะสมบล็อก import แรก (ยกเว้นของ module นี้)
      if (inblock && $0 ~ /^import /) { buf = buf $0 ORS; next }

      # เจอบรรทัดแรกที่ไม่ใช่ import → แทรก import เป้าหมาย
      if (inblock) {
        print buf "import { " names " } from \"" module "\";";
        inblock=0; inserted=1; buf=""
      }
      print $0
    }
    END{
      # ถ้าไฟล์ไม่มี import เลย แทรกบนสุด
      if (!inserted) {
        if (buf != "") print buf
        print "import { " names " } from \"" module "\";"
      }
    }
  ' "$file" > "$file.tmp" && mv "$file.tmp" "$file"

  echo "[OK] Unified imports -> $file"
}

# ---------- PermissionsPage.tsx ----------
perm_file="$PAGES/PermissionsPage.tsx"
if [[ -f "$perm_file" ]]; then
  unify_imports_file "$perm_file" "permsList, permsCreate, permsDelete"
  # กัน TS unknown[]: ใส่ type ให้ comparator/Set
  if grep -q 'new Set(list).*localeCompare' "$perm_file"; then
    backup_once "$perm_file"
    perl -0777 -i -pe 's/\[\.\.\.new Set\(list\)\]\.sort\(\(a,b\)=>a\.localeCompare\(b\)\)/[...new Set(list as string[])].sort((a: string,b: string)=>a.localeCompare(b))/s' "$perm_file" || true
  fi
  echo "[OK] Patched $perm_file"
else
  echo "[SKIP] $perm_file (not found)"
fi

# ---------- AdminUsersPage.tsx ----------
users_file="$PAGES/AdminUsersPage.tsx"
if [[ -f "$users_file" ]]; then
  unify_imports_file "$users_file" "usersList, usersCreate, usersUpdate, usersDelete, type UserRow, type UserStatus"
  # UserRow["status"] → UserStatus | undefined
  if grep -q 'UserRow\["status"\]' "$users_file"; then
    backup_once "$users_file"
    perl -0777 -i -pe 's/UserRow\["status"\]/UserStatus | undefined/g' "$users_file" || true
  fi
  # status: next as any → status: next
  if grep -q 'status:\s*next as any' "$users_file"; then
    backup_once "$users_file"
    perl -0777 -i -pe 's/status:\s*next as any/status: next/g' "$users_file" || true
  fi
  echo "[OK] Patched $users_file"
else
  echo "[SKIP] $users_file (not found)"
fi

# ---------- RolesPage.tsx ----------
roles_file="$PAGES/RolesPage.tsx"
if [[ -f "$roles_file" ]]; then
  unify_imports_file "$roles_file" "rolesList, rolesCreate, rolesUpdate, rolesDelete, rolesSetPerms, permsList, type RoleRow"
  echo "[OK] Patched $roles_file"
else
  echo "[SKIP] $roles_file (not found)"
fi

# ---------- SessionsPage.tsx ----------
sess_file="$PAGES/SessionsPage.tsx"
if [[ -f "$sess_file" ]]; then
  unify_imports_file "$sess_file" "listSessions, revokeSession, logoutApi"
  echo "[OK] Patched $sess_file"
else
  echo "[SKIP] $sess_file (not found)"
fi

# ---------- InventoryReceivePage.tsx ----------
recv_file="$PAGES/InventoryReceivePage.tsx"
if [[ -f "$recv_file" ]]; then
  unify_imports_file "$recv_file" "receiveCreate"
  echo "[OK] Patched $recv_file"
else
  echo "[SKIP] $recv_file (not found)"
fi

echo "Done."
