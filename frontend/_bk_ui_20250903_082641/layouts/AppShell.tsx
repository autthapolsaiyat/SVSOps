// FILE: src/layouts/AppShell.tsx
import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth.store";
import ThemeToggle from "@/components/ThemeToggle";

import ScanModal from "@/components/qr/ScanModal";
import { parseQr } from "@/hooks/useQr";
import { QrCode } from "lucide-react";

import {
  LayoutDashboard, UserCircle, Activity,
  Users, Shield, KeyRound,
  Boxes, Contact, UsersRound,
  PackagePlus, Wrench, PackageMinus, ArrowLeftRight,
  ClipboardList, FilePlus,
  BarChart2, Upload, LogOut, Cog
} from "lucide-react";

function rolesFromToken(): string[] {
  const t = localStorage.getItem("access_token");
  if (!t) return [];
  const p = t.split(".")[1];
  try {
    const json = JSON.parse(atob(p.replace(/-/g, "+").replace(/_/g, "/")));
    return Array.isArray(json?.roles) ? json.roles : [];
  } catch { return []; }
}

export default function AppShell() {
  const { logout, perms } = useAuth();
  const nav = useNavigate();

  // ✅ QR Scan state + handler
  const [scanOpen, setScanOpen] = React.useState(false);
  const handleScanResult = React.useCallback((text: string) => {
    const res = parseQr(text);
    if (res.type === "product")       nav(`/products?q=${encodeURIComponent(res.sku)}`);
    else if (res.type === "so")       nav(`/sales-orders?q=${encodeURIComponent(res.no)}`);
    else if (res.type === "loc")      nav(`/inventory/transfer?loc=${encodeURIComponent(res.code)}`);
    else if (res.type === "url")      window.location.assign(res.url);
    else                              nav(`/qr/resolve?raw=${encodeURIComponent(text)}`);
  }, [nav]);

  // dev bypass / superadmin (สำหรับกลุ่มอื่น ๆ ที่ยังใช้ perms)
  const bypass = (import.meta.env.VITE_BYPASS_AUTH?.toString() === "1") ||
                 (localStorage.getItem("dev:bypass") === "1");
  const roles = rolesFromToken();
  const isSuper = roles.includes("superadmin");
  const hasAny = (need: string[]) =>
    isSuper || bypass || (Array.isArray(perms) && need.some((p) => perms.includes(p)));

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-3 py-2 rounded transition
     text-[13px] md:text-sm
     ${isActive ? "bg-primary/15 text-primary" : "hover:bg-accent/60"}`;

  const Group = ({ title }: { title: string }) => (
    <div className="px-3 pt-3 pb-1 text-sm font-semibold tracking-wide text-muted-foreground">{title}</div>
  );

  return (
    <div className="min-h-screen flex text-foreground">
      <aside className="w-72 bg-card border-r border-border p-3 space-y-2">
        <div className="px-3 py-1.5 text-lg font-semibold">SVS-Ops</div>

        {/* ปุ่มสแกน QR/Barcode */}
        <button
          onClick={() => setScanOpen(true)}
          className="mx-3 mb-2 inline-flex items-center gap-2 px-3 py-1.5 rounded
                     bg-primary/15 text-primary hover:bg-primary/25"
          title="สแกน QR/Barcode"
        >
          <QrCode className="h-4 w-4" /> สแกน
        </button>

        {/* ภาพรวม */}
        <Group title="ภาพรวม" />
        <NavLink to="/dashboard" className={linkCls}><LayoutDashboard className="h-4 w-4" /> แดชบอร์ด</NavLink>
        <NavLink to="/me" className={linkCls}><UserCircle className="h-4 w-4" /> บัญชีของฉัน</NavLink>
        {hasAny(["ดูบันทึกกิจกรรม"]) && (
          <NavLink to="/sessions" className={linkCls}><Activity className="h-4 w-4" /> บันทึกกิจกรรม</NavLink>
        )}

        {/* ผู้ใช้และสิทธิ์ (ยังคงเช็ค perms/roles) */}
        {(hasAny(["ดูผู้ใช้","ดูบทบาท","ดูสิทธิ์"])) && (
          <>
            <Group title="ผู้ใช้และสิทธิ์" />
            {hasAny(["ดูผู้ใช้"]) && <NavLink to="/admin/users" className={linkCls}><Users className="h-4 w-4" /> ผู้ใช้</NavLink>}
            {hasAny(["ดูบทบาท"]) && <NavLink to="/admin/roles" className={linkCls}><Shield className="h-4 w-4" /> บทบาท</NavLink>}
            {hasAny(["ดูสิทธิ์"]) && <NavLink to="/admin/permissions" className={linkCls}><KeyRound className="h-4 w-4" /> สิทธิ์</NavLink>}
          </>
        )}

        {/* ข้อมูลหลัก */}
        <Group title="ข้อมูลหลัก" />
        <NavLink to="/products" className={linkCls}><Boxes className="h-4 w-4" /> สินค้า</NavLink>
        <NavLink to="/customers" className={linkCls}><Contact className="h-4 w-4" /> ลูกค้า</NavLink>
        <NavLink to="/staff-groups" className={linkCls}><UsersRound className="h-4 w-4" /> กลุ่มเจ้าหน้าที่</NavLink>

        {/* คลังสินค้า (ยังคงเช็ค perms/roles) */}
        {(hasAny(["รับสินค้า","ปรับปรุงคงเหลือ","เบิก/ตัดสต็อก","โอนย้ายคลัง"])) && (
          <>
            <Group title="คลังสินค้า" />
            {hasAny(["รับสินค้า"])        && <NavLink to="/inventory/receive"  className={linkCls}><PackagePlus className="h-4 w-4" /> รับเข้า (Receive)</NavLink>}
            {hasAny(["ปรับปรุงคงเหลือ"])  && <NavLink to="/inventory/adjust"   className={linkCls}><Wrench className="h-4 w-4" /> ปรับปรุงคงเหลือ (Adjust)</NavLink>}
            {hasAny(["เบิก/ตัดสต็อก"])    && <NavLink to="/inventory/issue"    className={linkCls}><PackageMinus className="h-4 w-4" /> เบิก/ตัดสต็อก (Issue)</NavLink>}
            {hasAny(["โอนย้ายคลัง"])      && <NavLink to="/inventory/transfer" className={linkCls}><ArrowLeftRight className="h-4 w-4" /> โอนย้ายคลัง (Transfer)</NavLink>}
          </>
        )}

        {/* เอกสาร — แสดงเสมอ แล้วให้ Route guard เช็คสิทธิ์ตอนเข้าเพจ */}
        <>
          <Group title="เอกสาร" />
          <NavLink to="/quotations" className={linkCls}>
            <ClipboardList className="h-4 w-4" /> ใบเสนอราคา
          </NavLink>
          <NavLink to="/purchases" className={linkCls}>
            <FilePlus className="h-4 w-4" /> สร้างใบสั่งซื้อ
          </NavLink>
          <NavLink to="/sales/new" className={linkCls}>
            <FilePlus className="h-4 w-4" /> สร้างใบสั่งขาย
          </NavLink>
        </>

        {/* เครื่องมือ — แสดงเสมอ แล้วให้ Route guard เช็คสิทธิ์ตอนเข้าเพจ */}
        <>
          <Group title="เครื่องมือ" />
          <NavLink to="/sales-reps" className={linkCls}>
            <Users className="h-4 w-4" /> ผู้ขาย (Sales Reps)
          </NavLink>
          <NavLink to="/reports" className={linkCls}>
            <BarChart2 className="h-4 w-4" /> รายงาน
          </NavLink>
          <NavLink to="/importer" className={linkCls}>
            <Upload className="h-4 w-4" /> นำเข้าข้อมูล
          </NavLink>
          <NavLink to="/settings" className={linkCls}>
            <Cog className="h-4 w-4" /> Settings
          </NavLink>
        </>

        {/* Toggle theme + Logout */}
        <div className="mt-4 px-1"><ThemeToggle /></div>
        <button
          onClick={() => { logout(); nav("/login", { replace: true }); }}
          className="mt-3 w-full text-left px-3 py-2 rounded bg-secondary hover:bg-secondary/80 text-secondary-foreground
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 flex items-center gap-2"
        >
          <LogOut className="h-4 w-4" /> ออกจากระบบ
        </button>

        {/* ✅ Modal สแกน */}
        <ScanModal open={scanOpen} onClose={() => setScanOpen(false)} onResult={handleScanResult} />
      </aside>

      <main className="flex-1 p-4 bg-background">
        <Outlet />
      </main>
    </div>
  );
}

