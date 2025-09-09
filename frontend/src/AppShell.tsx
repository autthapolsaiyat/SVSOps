// FILE: src/AppShell.tsx
import { Link, Outlet, useLocation } from "react-router-dom";

export default function AppShell() {
  const { pathname } = useLocation();
  const Item = ({ to, label }: { to: string; label: string }) => (
    <Link
      to={to}
      className={`px-3 py-2 rounded-xl hover:opacity-80 ${
        pathname.startsWith(to) ? "font-semibold underline" : ""
      }`}
    >
      {label}
    </Link>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link to="/dashboard/summary" className="text-xl font-bold">SVS-Ops</Link>
          <nav className="flex items-center gap-2">
            {/* แสดงเสมอ */}
            <Item to="/documents" label="เอกสาร" />
            <Item to="/tools" label="เครื่องมือ" />
            {/* กลุ่มหลัก */}
            <Item to="/dashboard/summary" label="Dashboard" />
            <Item to="/products" label="Products" />
            <Item to="/sales/quotations" label="Quotations" />
            <Item to="/purchases" label="POs" />
            <Item to="/sales" label="SOs" />
            <Item to="/inventory/receive" label="Inventory" />
            <Item to="/settings" label="Settings" />
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}

