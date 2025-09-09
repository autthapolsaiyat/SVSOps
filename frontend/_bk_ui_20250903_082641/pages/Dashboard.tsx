// FILE: src/pages/Dashboard.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import api from "@/lib/api.client";
import { listProducts, type Product } from "@/lib/api.products";

type Summary = {
  totals?: { products?: number; customers?: number; stock_on_hand?: number; reserved?: number };
  month_docs?: { quotations?: number; pos?: number; sos?: number };
  latest_q_no?: string;
  [k: string]: any;
};

type SeriesRow = { date: string; q?: number; po?: number; so?: number; [k: string]: any };

export default function Dashboard() {
  const [loading, setLoading] = useState(false);
  const [days, setDays] = useState(14);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [series, setSeries] = useState<SeriesRow[]>([]);
  const [topByPrice, setTopByPrice] = useState<Product[]>([]);
  const [err, setErr] = useState<string | null>(null);

  async function loadAll(d = days) {
    setLoading(true);
    setErr(null);
    try {
      // 1) Summary (normalize payload ใหม่ให้เข้ากับโครงหน้า)
      const raw = await api.get<any>(`/dashboard/summary?days=${encodeURIComponent(d)}`);

      const normalized: Summary = {
        totals: {
          products: raw?.totals?.products ?? raw?.total_products ?? raw?.products ?? 0,
          customers: raw?.totals?.customers ?? raw?.total_customers ?? raw?.customers ?? undefined,
          stock_on_hand: raw?.totals?.stock_on_hand ?? raw?.stock_on_hand ?? undefined,
          reserved: raw?.totals?.reserved ?? raw?.reserved ?? undefined,
        },
        month_docs: {
          quotations: raw?.month_docs?.quotations ?? raw?.quotes_this_month ?? 0,
          pos: raw?.month_docs?.pos ?? raw?.pos_this_month ?? 0,
          sos: raw?.month_docs?.sos ?? raw?.sos_this_month ?? 0,
        },
        latest_q_no: raw?.latest_q_no ?? raw?.last_quote_number,
      };
      setSummary(normalized);

      // 2) Timeseries (quotes/pos/sos -> q/po/so)
      const trows = await api.get<any[]>(`/dashboard/timeseries?days=${encodeURIComponent(d)}`);
      const mapped = (Array.isArray(trows) ? trows : []).map((r) => ({
        date: r.date,
        q: r.q ?? r.quotes ?? 0,
        po: r.po ?? r.pos ?? 0,
        so: r.so ?? r.sos ?? 0,
      }));
      setSeries(mapped);

      // 3) Stock totals (เติมให้ summary ถ้ายังไม่มี)
      try {
        const st = await api.get<any>("/dashboard/stock");
        setSummary((prev) => {
          const cur = prev ?? {};
          return {
            ...cur,
            totals: {
              ...(cur.totals ?? {}),
              stock_on_hand: cur?.totals?.stock_on_hand ?? st?.total_on_hand ?? st?.on_hand,
              reserved: cur?.totals?.reserved ?? st?.total_reserved ?? st?.reserved,
            },
          };
        });
      } catch { /* ไม่เป็นไร หน้าไม่ล้ม */ }

      // 4) Top-5 by price: ใช้จาก summary ถ้ามี มิฉะนั้น fallback ดึงจาก products
      const topFromSummary = Array.isArray(raw?.top5_by_price) ? raw.top5_by_price : null;
      if (topFromSummary && topFromSummary.length) {
        const items: Product[] = topFromSummary.map((x: any, i: number) => ({
          id: x.id ?? String(i),
          sku: x.sku ?? "",
          name: x.name ?? "",
          unit: x.unit ?? "",
          price_ex_vat: x.price_ex_vat ?? x.price ?? 0,
          team_id: x.team_id,
        }));
        setTopByPrice(items);
      } else {
        const top = await listProducts({ per_page: 5, sort: "price_ex_vat", order: "desc" });
        setTopByPrice(top.items ?? []);
      }
    } catch (e: any) {
      console.error("[Dashboard] load error:", e);
      setErr(e?.message || "โหลดข้อมูลไม่สำเร็จ");
      setSummary(null);
      setSeries([]);
      setTopByPrice([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll(days);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  const totals = useMemo(() => summary?.totals ?? {}, [summary]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <div className="flex items-center gap-2">
          <select
            className="border rounded-md px-2 py-1 text-sm bg-transparent"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            {[7, 14, 30, 60, 90].map((n) => (
              <option key={n} value={n}>{n} วัน</option>
            ))}
          </select>
          <Button variant="outline" onClick={() => loadAll()} disabled={loading}>
            {loading ? "กำลังโหลด..." : "รีเฟรช"}
          </Button>
        </div>
      </div>

      {err && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600">
          {err}
        </div>
      )}

      {/* KPIs */}
      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="สินค้า" value={totals.products ?? "-"} />
        <Kpi label="ลูกค้า" value={totals.customers ?? "-"} />
        <Kpi label="คงคลัง (on-hand)" value={totals.stock_on_hand ?? "-"} />
        <Kpi label="จอง (reserved)" value={totals.reserved ?? "-"} />
      </section>

      {/* Top-5 by price */}
      <section className="space-y-2">
        <h2 className="text-base font-semibold">Top-5 ราคา (จากสินค้า)</h2>
        <Table className="bg-transparent">
          <TableHeader>
            <TableRow className="bg-transparent">
              <TableHead>SKU</TableHead>
              <TableHead>ชื่อ</TableHead>
              <TableHead className="text-right">ราคา (ก่อน VAT)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {topByPrice.map((p) => (
              <TableRow key={p.id} className="bg-panel-soft">
                <TableCell className="font-mono">{p.sku}</TableCell>
                <TableCell>{p.name}</TableCell>
                <TableCell className="text-right">
                  {Number((p as any).price_ex_vat ?? (p as any).price ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </TableCell>
              </TableRow>
            ))}
            {topByPrice.length === 0 && (
              <TableRow className="bg-transparent">
                <TableCell colSpan={3} className="text-center py-6 opacity-70">
                  ไม่มีข้อมูล
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>

      {/* Timeseries */}
      <section className="space-y-2">
        <h2 className="text-base font-semibold">Series {days} วันล่าสุด</h2>
        <div className="text-sm bg-panel-soft rounded-xl p-3 space-y-1">
          {series.length ? (
            series.map((r) => (
              <div key={r.date} className="flex justify-between">
                <span className="font-mono">{r.date}</span>
                <span>Q:{r.q ?? 0} • PO:{r.po ?? 0} • SO:{r.so ?? 0}</span>
              </div>
            ))
          ) : (
            <div className="opacity-70">ไม่มีข้อมูล</div>
          )}
        </div>
      </section>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-panel bg-panel p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold mt-1">{typeof value === "number" ? value.toLocaleString() : value}</div>
    </div>
  );
}

