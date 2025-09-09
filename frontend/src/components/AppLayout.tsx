// ————————————————————————————————————————————————
// FILE: src/components/AppLayout.tsx (Sidebar + Topbar เมนูครบ)
//--------------------------------------------------
import React from "react";
import { NavLink, Outlet } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ShoppingCart, FileText, Package, ClipboardList, LayoutDashboard, Layers3, ReceiptText, Boxes } from "lucide-react";


const MenuItem = ({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) => (
<NavLink to={to} className={({isActive})=>cn("flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-muted", isActive && "bg-muted font-semibold") }>
{icon}<span>{label}</span>
</NavLink>
);


export default function AppLayout(){
return (
<div className="min-h-screen grid grid-cols-[260px_1fr]">
<aside className="border-r p-4 space-y-3">
<div className="text-lg font-bold">SVS‑Ops</div>
<nav className="space-y-1">
<MenuItem to="/dashboard" icon={<LayoutDashboard size={18}/>} label="Dashboard" />
<MenuItem to="/products" icon={<Boxes size={18}/>} label="สินค้า" />
<div className="pt-2 text-xs uppercase text-muted-foreground">ขาย</div>
<MenuItem to="/quotes" icon={<ClipboardList size={18}/>} label="ใบเสนอราคา" />
<MenuItem to="/sales" icon={<ShoppingCart size={18}/>} label="ขาย/วางบิล" />
<MenuItem to="/invoices" icon={<ReceiptText size={18}/>} label="ใบวางบิล/ตัดสต๊อค" />
<div className="pt-2 text-xs uppercase text-muted-foreground">จัดซื้อ/สต๊อค</div>
<MenuItem to="/po" icon={<FileText size={18}/>} label="ใบสั่งซื้อ" />
<MenuItem to="/gr" icon={<Package size={18}/>} label="นำเข้า (GR)" />
<MenuItem to="/stock" icon={<Layers3 size={18}/>} label="Stock Console" />
</nav>
<div className="pt-4">
<Button variant="outline" size="sm" onClick={()=>{ localStorage.clear(); location.href="/login"; }}>Logout</Button>
</div>
</aside>
<main className="p-4">
<Outlet />
</main>
</div>
);
}
