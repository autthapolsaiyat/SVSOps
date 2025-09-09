// FILE: src/layouts/AppShell.tsx
import React, { useMemo } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/ThemeToggle";
import { can } from "@/lib/auth";

export default function AppShell() {
  const nav = useNavigate();
  const hasToken =
    !!localStorage.getItem("access_token") || !!localStorage.getItem("token");

  function logout() {
    try {
      localStorage.removeItem("access_token");
      localStorage.removeItem("token");
      localStorage.removeItem("auth_user");
      localStorage.removeItem("auth_perms");
    } finally {
      nav("/login", { replace: true });
    }
  }

  const NAV = useMemo(() => {
    const items: Array<{ to: string; label: string; show: boolean }> = [
      { to: "/stock",    label: "Stock Console", show: can("stock:receive","stock:issue") || can("stock:*","*") },
      { to: "/levels",   label: "Stock Levels",  show: can("report:view","*") },
      { to: "/card",     label: "Stock Card",    show: can("report:view","*") },
      { to: "/importer", label: "Importer",      show: can("import:data","products:update","*") },
      { to: "/products", label: "Products",      show: can("products:read","*") },
      { to: "/po",       label: "PO Inbox",      show: can("po:read","*") },
      { to: "/reports",  label: "Reports",       show: can("report:view","*") },
    ];
    return items.filter(i => i.show);
  }, []);

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `px-2 py-1 rounded-md transition ${
      isActive ? "bg-white/10 text-white" : "hover:bg-white/5 text-foreground/80"
    }`;

  return (
    <div className="min-h-screen">
      <a href="#app-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:ring-2 focus:ring-primary bg-card text-card-foreground px-3 py-1 rounded">
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-border bg-card/60 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/home" className="font-semibold tracking-tight hover:opacity-80" aria-label="SVS-Ops Home">
              SVS-Ops
            </Link>
            <nav className="hidden sm:flex items-center gap-2 text-sm opacity-90" aria-label="Main">
              {NAV.map((n) => <NavLink key={n.to} to={n.to} className={navClass}>{n.label}</NavLink>)}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/home" className="text-sm underline opacity-80 hover:opacity-100 hidden sm:inline">Home</Link>
            <ThemeToggle />
            {hasToken ? (
              <Button variant="outline" size="sm" onClick={logout}>Logout</Button>
            ) : (
              <Link to="/login"><Button size="sm">Login</Button></Link>
            )}
          </div>
        </div>
      </header>

      <main id="app-content" className="mx-auto max-w-6xl p-6">
        <Outlet />
      </main>
    </div>
  );
}

