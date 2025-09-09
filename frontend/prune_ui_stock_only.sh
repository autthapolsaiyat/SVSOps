#!/usr/bin/env bash
set -euo pipefail

echo "==> Backup current UI files"
TS=$(date +%Y%m%d_%H%M%S)
BK="_bk_ui_${TS}"
mkdir -p "$BK"
cp -r src/pages "$BK/pages" 2>/dev/null || true
cp -r src/layouts "$BK/layouts" 2>/dev/null || true
cp -f src/App.tsx "$BK/App.tsx" 2>/dev/null || true

echo "==> Keep only stock-related pages"
KEEP=(LoginPage.tsx ImporterPage.tsx StockConsolePage.tsx StockLevelsPage.tsx ProductsPage.tsx MePage.tsx)
cd src/pages
find . -type f | while read -r f; do
  base=$(basename "$f")
  keep=0
  for k in "${KEEP[@]}"; do [[ "$base" == "$k" ]] && keep=1 && break; done
  if [[ $keep -eq 0 ]]; then rm -f "$f"; fi
done
cd ../..

echo "==> Overwrite layouts/AppShell.tsx with minimal shell"
mkdir -p src/layouts
cat > src/layouts/AppShell.tsx <<'TSX'
import React from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/stock",    label: "Stock Console" },
  { to: "/levels",   label: "Stock Levels" },
  { to: "/importer", label: "Importer" },
  { to: "/products", label: "Products" },
  { to: "/me",       label: "My Profile" },
];

export default function AppShell() {
  const loc = useLocation();
  return (
    <div className="min-h-screen grid grid-cols-[240px_1fr]">
      <aside className="border-r border-border p-4 space-y-2">
        <div className="text-lg font-semibold">SVS-Ops</div>
        <nav className="flex flex-col gap-1">
          {NAV.map(n => {
            const active = loc.pathname === n.to;
            return (
              <Link key={n.to} to={n.to}
                className={`px-3 py-2 rounded ${active ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-4">
          <Link to="/login"><Button variant="outline" className="w-full">Logout / Login</Button></Link>
        </div>
      </aside>
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  );
}
TSX

echo "==> Overwrite App.tsx with minimal router + guard"
cat > src/App.tsx <<'TSX'
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AppShell from "@/layouts/AppShell";
import LoginPage from "@/pages/LoginPage";
import ImporterPage from "@/pages/ImporterPage";
import StockConsolePage from "@/pages/StockConsolePage";
import StockLevelsPage from "@/pages/StockLevelsPage";
import ProductsPage from "@/pages/ProductsPage";
import MePage from "@/pages/MePage";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("access_token") || localStorage.getItem("token");
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<RequireAuth><AppShell /></RequireAuth>}>
          <Route index element={<Navigate to="/stock" replace />} />
          <Route path="stock" element={<StockConsolePage />} />
          <Route path="levels" element={<StockLevelsPage />} />
          <Route path="importer" element={<ImporterPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="me" element={<MePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/stock" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
TSX

echo "==> Done. Backup saved at: $BK"
