#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PAGES="$ROOT/frontend/src/pages"

backup_once () {
  local f="$1"
  if [[ -f "$f" && ! -f "$f.bak-20250830" ]]; then
    cp "$f" "$f.bak-20250830"
  fi
}

# เพิ่ม import จากโมดูลเดิม โดยไม่ซ้ำชื่อ (append เฉพาะที่ยังไม่มี)
ensure_import () {
  local file="$1"; shift
  local module="$1"; shift
  local IFS=','; read -ra names <<< "$*"

  for name in "${names[@]}"; do
    name="$(echo "$name" | xargs)"
    # ถ้ามีชื่อ import อยู่แล้วให้ข้าม
    if grep -E "import\s*\{[^}]*\b${name}\b[^}]*\}\s*from\s*\"${module}\"" -q "$file"; then
      continue
    fi
    # ถ้ายังไม่มี import จาก module นี้เลย ให้สร้างบรรทัดใหม่
    if ! grep -E "from\s*\"${module}\"" -q "$file"; then
      backup_once "$file"
      printf 'import { %s } from "%s";\n' "$name" "$module" | \
        awk -v ins="$(cat)" 'BEGIN{printed=0} {if(!printed && $0 ~ /^import /){print $0; print ins; printed=1} else print $0}' "$file" > "${file}.tmp" \
        && mv "${file}.tmp" "$file"
    else
      # มี import จาก module เดียวกันแล้ว แต่ไม่มีชื่อนี้ → เพิ่ม import แยกบรรทัด (เลี่ยงแกะ string เดิมให้พัง)
      backup_once "$file"
      awk -v mod="$module" -v nm="$name" '
        BEGIN{added=0}
        {print $0}
        END{
          if(!added){
            printf("import { %s } from \"%s\";\n", nm, mod);
          }
        }
      ' "$file" > "${file}.tmp" && mv "${file}.tmp" "$file"
    fi
  done
}

# ---- PermissionsPage.tsx ----
perm_file="$PAGES/PermissionsPage.tsx"
if [[ -f "$perm_file" ]]; then
  ensure_import "$perm_file" "@/lib/api.client" "permsList, permsCreate, permsDelete"

  # แก้ setItems([...new Set(list)].sort(...)) ให้ type ชัด (กัน TS unknown[])
  if grep -q '\.sort((a,b)=>a\.localeCompare\(b\))' "$perm_file"; then
    backup_once "$perm_file"
    perl -0777 -i -pe 's/setItems\(\[\.\.\.new Set\(list\)\]\.sort\(\(a,b\)=>a\.localeCompare\(b\)\)\);/setItems([...new Set(list as string[])].sort((a: string,b: string)=>a.localeCompare(b)));/s' "$perm_file"
  fi
  echo "[OK] Patched $perm_file"
else
  echo "[SKIP] $perm_file (not found)"
fi

# ---- AdminUsersPage.tsx ----
users_file="$PAGES/AdminUsersPage.tsx"
if [[ -f "$users_file" ]]; then
  ensure_import "$users_file" "@/lib/api.client" "usersList, usersCreate, usersUpdate, usersDelete, type UserRow, type UserStatus"

  # แก้ type ของ StatusPill: UserRow["status"] -> UserStatus | undefined
  if grep -q 'UserRow\["status"\]' "$users_file"; then
    backup_once "$users_file"
    perl -0777 -i -pe 's/UserRow\["status"\]/UserStatus | undefined/g' "$users_file"
  fi
  # เอา as any ออกจากการอัปเดต status
  if grep -q 'status:\s*next as any' "$users_file"; then
    backup_once "$users_file"
    perl -0777 -i -pe 's/status:\s*next as any/status: next/g' "$users_file"
  fi
  echo "[OK] Patched $users_file"
else
  echo "[SKIP] $users_file (not found)"
fi

# ---- RolesPage.tsx ----
roles_file="$PAGES/RolesPage.tsx"
if [[ -f "$roles_file" ]]; then
  ensure_import "$roles_file" "@/lib/api.client" "rolesList, rolesCreate, rolesUpdate, rolesDelete, rolesSetPerms, permsList, type RoleRow"
  echo "[OK] Patched $roles_file"
else
  echo "[SKIP] $roles_file (not found)"
fi

# ---- SessionsPage.tsx ----
sess_file="$PAGES/SessionsPage.tsx"
if [[ -f "$sess_file" ]]; then
  ensure_import "$sess_file" "@/lib/api.client" "listSessions, revokeSession, logoutApi"
  echo "[OK] Patched $sess_file"
else
  echo "[SKIP] $sess_file (not found)"
fi

# ---- InventoryReceivePage.tsx ----
recv_file="$PAGES/InventoryReceivePage.tsx"
if [[ -f "$recv_file" ]]; then
  ensure_import "$recv_file" "@/lib/api.client" "receiveCreate"
  echo "[OK] Patched $recv_file"
else
  echo "[SKIP] $recv_file (not found)"
fi

echo "Done."
