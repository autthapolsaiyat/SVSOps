#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-$HOME/SVS-Ops}"

echo "==> Scaffolding Phase 1 under: $ROOT"

dirs=(
  "backend/app/security"
  "backend/app/services"
  "backend/app/schemas"
  "backend/app/routers"
  "db/init"
)

for d in "${dirs[@]}"; do
  install -d "$ROOT/$d"
done

make_file() {
  local f="$ROOT/$1"
  if [[ -e "$f" ]]; then
    echo "[skip] $1 (exists)"
  else
    mkdir -p "$(dirname "$f")"
    : > "$f"
    echo "[new ] $1"
  fi
}

make_file "backend/app/main.py"
make_file "backend/app/database.py"
make_file "backend/app/models.py"
make_file "backend/app/deps.py"

make_file "backend/app/security/password.py"
make_file "backend/app/security/jwtauth.py"

make_file "backend/app/services/rbac_service.py"

make_file "backend/app/schemas/auth.py"
make_file "backend/app/schemas/user.py"

make_file "backend/app/routers/health.py"
make_file "backend/app/routers/auth.py"
make_file "backend/app/routers/admin_users.py"
make_file "backend/app/routers/inventory.py"

make_file "db/init/20-auth_rbac.sql"
make_file "db/init/21-seed_rbac.sql"

make_file "backend/requirements.txt"

echo "==> Done. Now open each file and paste the code from the ZIP."
echo "Tip: verify with: tree -L 4 \"$ROOT\""
