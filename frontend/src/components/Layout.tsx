import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

const item = "px-3 py-2 block text-sm rounded hover:bg-zinc-800";
const active = "bg-zinc-900 text-white border-l-2 border-l-sky-500 " + item;

export default function Layout() {
  const nav = useNavigate();
  const username = localStorage.getItem("username") || "admin";
  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    nav("/login", { replace: true });
  }
  return (
    <div className="min-h-screen flex bg-black text-zinc-100">
      <aside className="w-56 border-r border-zinc-800 p-3">
        <div className="font-semibold mb-3">SVS-Ops</div>
        <nav className="space-y-1">
          <NavLink to="/dashboard" className={({ isActive }) => (isActive ? active : item)}>Dashboard</NavLink>
          <NavLink to="/products" className={({ isActive }) => (isActive ? active : item)}>สินค้า</NavLink>
          <NavLink to="/quotes" className={({ isActive }) => (isActive ? active : item)}>ใบเสนอราคา</NavLink>
          <NavLink to="/purchase-orders" className={({ isActive }) => (isActive ? active : item)}>ใบสั่งซื้อ</NavLink>
          <NavLink to="/goods-receipts" className={({ isActive }) => (isActive ? active : item)}>ใบรับสินค้า (GR)</NavLink>
          <NavLink to="/sales-orders" className={({ isActive }) => (isActive ? active : item)}>ใบขาย</NavLink>
          <NavLink to="/invoices" className={({ isActive }) => (isActive ? active : item)}>ใบแจ้งหนี้</NavLink>
        </nav>
      </aside>

      <div className="flex-1 flex flex-col">
        {/* Sticky header */}
        <header className="sticky top-0 z-50 bg-black/80 backdrop-blur border-b border-zinc-800 py-2 px-4 flex items-center justify-between">
          <div className="text-sm opacity-70">SVS-Ops</div>
          <div className="flex items-center gap-3">
            <span className="text-sm opacity-70">{username}</span>
            <button
              onClick={logout}
              className="px-3 py-1 rounded border border-zinc-700 hover:bg-zinc-800 text-sm"
            >
              Logout
            </button>
          </div>
        </header>

        <main className="flex-1 p-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

