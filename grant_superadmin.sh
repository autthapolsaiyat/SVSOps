#!/usr/bin/env bash
set -euo pipefail

API="${API:-http://localhost:8080/api}"
LOGIN_USER="${LOGIN_USER:-sysop}"
LOGIN_PASS="${LOGIN_PASS:-admin}"

command -v jq >/dev/null 2>&1 || { echo "❌ ต้องมี jq (macOS: brew install jq)"; exit 1; }

echo "→ Login as $LOGIN_USER ..."
T=$(curl -sS -X POST "$API/auth/login" \
     -H 'Content-Type: application/json' \
     -d "{\"username\":\"$LOGIN_USER\",\"password\":\"$LOGIN_PASS\"}" | jq -r .access_token)
[[ -n "${T:-}" && "$T" != "null" ]] || { echo "❌ LOGIN FAILED"; exit 1; }
echo "✓ TOKEN OK"

echo "→ Check current permissions"
ME_BEFORE=$(curl -sS "$API/auth/me" -H "Authorization: Bearer $T")
echo "$ME_BEFORE" | jq '{username,roles,permissions,perms}' || true
HAS_STAR=$(echo "$ME_BEFORE" | jq -r '[.permissions[]?, .perms[]?] | index("*")')
if [[ "$HAS_STAR" != "null" ]]; then
  echo "✓ มีสิทธิ์ * อยู่แล้ว — ไม่ต้องทำอะไร"; exit 0
fi

echo "→ เพิ่มสิทธิ์ *"
# 1) เพิ่ม perm '*'
curl -sS -X POST "$API/admin/perms" \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $T" \
  -d '{"perm":"*"}' >/dev/null 2>&1 || true

# 2) หา/สร้าง role 'superadmin'
RID=$(curl -sS "$API/admin/roles" -H "Authorization: Bearer $T" \
      | jq -r '.[]? | select(.name=="superadmin") | .id' | head -n1)
if [[ -z "${RID:-}" || "$RID" == "null" ]]; then
  RID=$(curl -sS -X POST "$API/admin/roles" \
        -H 'Content-Type: application/json' -H "Authorization: Bearer $T" \
        -d '{"name":"superadmin","description":"full access"}' | jq -r .id)
  echo "✓ สร้าง role superadmin: $RID"
else
  echo "✓ พบ role superadmin: $RID"
fi

# 3) ใส่ '*' ให้ role superadmin (merge ของเดิม)
CUR_PERMS=$(curl -sS "$API/admin/roles" -H "Authorization: Bearer $T" \
           | jq -r --arg rid "$RID" '.[]?|select(.id==$rid)|.perms|.[]?' || true)
NEW_PERMS=$(printf "%s\n*\n" "$CUR_PERMS" | sort -u | jq -R -s -c 'split("\n")|map(select(length>0))')
curl -sS -X PUT "$API/admin/roles/$RID/perms" \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $T" \
  -d "{\"perms\":$NEW_PERMS}" >/dev/null
echo "✓ ตั้ง perms superadmin = $NEW_PERMS"

# 4) ผูก role 'superadmin' ให้ user 'sysop' (คง role เดิมไว้)
UID=$(curl -sS "$API/admin/users" -H "Authorization: Bearer $T" \
      | jq -r '.[]? | select(.username=="sysop") | .id' | head -n1)
[[ -n "${UID:-}" && "$UID" != "null" ]] || { echo "❌ หา user sysop ไม่เจอ"; exit 1; }

CUR_ROLES=$(curl -sS "$API/admin/users" -H "Authorization: Bearer $T" \
           | jq -r '.[]? | select(.id=="'"$UID"'") | .roles | .[]?' || true)
NEW_ROLES=$(printf "%s\nsuperadmin\nsysop\n" "$CUR_ROLES" | sort -u | jq -R -s -c 'split("\n")|map(select(length>0))')
curl -sS -X PATCH "$API/admin/users/$UID" \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $T" \
  -d "{\"roles\":$NEW_ROLES}" >/dev/null
echo "✓ ตั้ง roles ของ sysop = $NEW_ROLES"

echo "→ ตรวจซ้ำหลังแก้"
curl -sS "$API/auth/me" -H "Authorization: Bearer $T" | jq '{username,roles,permissions,perms}'
echo "✅ DONE"
