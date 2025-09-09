// FILE: src/pages/DiagnosticsPage.tsx
import React, { useEffect, useState } from "react";

type Row = { name: string; url: string; status?: number; ms?: number; error?: string };
const CHECKS: Row[] = [
  { name: "ready", url: "/api/ready" },
  { name: "dashboard.summary", url: "/api/dashboard/summary" },
  { name: "dashboard.timeseries", url: "/api/dashboard/timeseries?days=14" },
  { name: "dashboard.stock", url: "/api/dashboard/stock" },
  { name: "products.list", url: "/api/products?per_page=5" },
  { name: "customers.list (shim)", url: "/api/customers?per_page=5" },
  { name: "quotations.list (shim)", url: "/api/sales/quotations?per_page=5" },
  { name: "sales-orders.list (shim)", url: "/api/sales-orders?per_page=5" },
  { name: "sales-reps (shim)", url: "/api/sales/quotations/sales-reps" },
  { name: "reports (shim)", url: "/api/reports" },
  { name: "admin.users", url: "/api/admin/users" },
  { name: "admin.roles (shim)", url: "/api/admin/roles" },
  { name: "admin.perms (shim)", url: "/api/admin/perms" },
  { name: "auth.me", url: "/api/auth/me" },
];

export default function DiagnosticsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    (async () => {
      const out: Row[] = [];
      for (const r of CHECKS) {
        const t0 = performance.now();
        try {
          const res = await fetch(r.url);
          out.push({ ...r, status: res.status, ms: Math.round(performance.now() - t0) });
        } catch (e: any) {
          out.push({ ...r, status: 0, ms: Math.round(performance.now() - t0), error: e?.message || String(e) });
        }
      }
      setRows(out);
    })();
  }, []);
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Diagnostics</h1>
      <div className="text-sm text-muted-foreground">Origin: {window.location.origin}</div>
      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-card border-b">
            <tr><th className="p-2 text-left">Check</th><th className="p-2 text-left">URL</th><th className="p-2 text-right">Status</th><th className="p-2 text-right">Time</th><th className="p-2 text-left">Error</th></tr>
          </thead>
          <tbody>
            {rows.map((r,i)=>(
              <tr key={i} className="border-b last:border-0">
                <td className="p-2">{r.name}</td>
                <td className="p-2 font-mono">{r.url}</td>
                <td className={`p-2 text-right ${r.status && r.status>=200 && r.status<300 ? "text-green-600" : r.status===0 ? "text-amber-600" : "text-red-600"}`}>{r.status ?? "-"}</td>
                <td className="p-2 text-right">{r.ms?`${r.ms}ms`:"-"}</td>
                <td className="p-2">{r.error??""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">แนะนำเปิดจาก 8081 (Nginx) เพื่อให้ endpoint ถูก proxy อัตโนมัติ</p>
    </div>
  );
}
