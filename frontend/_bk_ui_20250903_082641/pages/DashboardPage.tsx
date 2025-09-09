// FILE: src/pages/DashboardPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api.client";

type Summary = {
  totals?: { products?: number; customers?: number; stock_on_hand?: number; reserved?: number };
  month_docs?: { quotations?: number; pos?: number; sos?: number };
  latest_q_no?: string;
};

type SeriesRow = { date: string; quotes?: number; pos?: number; sos?: number };

export default function DashboardPage() {
  const [loading, setLoading] = useState(false);
  const [days, setDays] = useState(14);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [series, setSeries] = useState<SeriesRow[]>([]);
  const [stock, setStock] = useState<{ on_hand?: number; reserved?: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function loadAll(d: number) {
    setLoading(true);
    setErr(null);
    try {
      if (localStorage.DEBUG_ROUTE === "1") console.info("[PAGE] Dashboard loadAll days=", d);
      const [s, t, st] = await Promise.all([
        api.get<Summary>("/dashboard/summary"),
        api.get<any[]>(`/dashboard/timeseries?days=${encodeURIComponent(d)}`),
        api.get<{ on_hand?: number; reserved?: number }>("/dashboard/stock").catch(() => ({ on_hand: undefined, reserved: undefined })),
      ]);
      // timeseries อาจส่ง field quotes/pos/sos หรือ q/po/so → normalize
      const norm = (t || []).map((r: any) => ({
        date: r.date,
        quotes: r.quotes ?? r.q ?? 0,
        pos: r.pos ?? 0,
        sos: r.sos ?? r.so ?? 0,
      }));
      setSummary(s || {});
      setSeries(norm);
      setStock({ on_hand: st?.on_hand, reserved: st?.reserved });
    } catch (e: any) {
      setErr(e?.message || "โหลดข้อมูลไม่สำเร็จ");
      setSummary(null);
      setSeries([]);
      setStock(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(days); /* eslint-disable-next-line */ }, [days]);

  const totals = useMemo(() => summary?.totals ?? {}, [summary]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">ภาพรวมระบบ</h1>
        <div className="flex items-center gap-2">
          <select
            className="border rounded-md px-2 py-1 text-sm bg-transparent"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            {[7, 14, 30, 60, 90].map((n) => <option key={n} value={n}>{n} วัน</option>)}
          </select>
          <Button variant="outline" onClick={() => loadAll(days)} disabled={loading}>
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
        <Kpi label="จำนวนสินค้า" value={totals.products ?? "-"} />
        <Kpi label="จำนวนลูกค้า" value={totals.customers ?? "-"} />
        <Kpi label="คงคลัง (on-hand)" value={stock?.on_hand ?? totals.stock_on_hand ?? "-"} />
        <Kpi label="จอง (reserved)" value={stock?.reserved ?? totals.reserved ?? "-"} />
      </section>

      {/* เดือนนี้ */}
      <Card className="bg-card border border-border">
        <CardHeader className="pb-3">
          <CardTitle>เอกสารเดือนนี้</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <DocPill label="Quotations" value={summary?.month_docs?.quotations ?? 0} />
            <DocPill label="POs"         value={summary?.month_docs?.pos ?? 0} />
            <DocPill label="SOs"         value={summary?.month_docs?.sos ?? 0} />
          </div>
          {summary?.latest_q_no && (
            <div className="mt-3 text-sm text-muted-foreground">
              เลข Q ล่าสุดของผู้ใช้: <span className="font-mono">{summary.latest_q_no}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Series */}
      <Card className="bg-card border border-border">
        <CardHeader className="pb-3">
          <CardTitle>สรุป {days} วันล่าสุด</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <Table className="bg-transparent">
              <TableHeader>
                <TableRow>
                  <TableHead>วันที่</TableHead>
                  <TableHead className="text-right">Q</TableHead>
                  <TableHead className="text-right">PO</TableHead>
                  <TableHead className="text-right">SO</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {series.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">ไม่มีข้อมูล</TableCell></TableRow>
                ) : series.map((r) => (
                  <TableRow key={r.date}>
                    <TableCell className="font-mono">{r.date}</TableCell>
                    <TableCell className="text-right">{r.quotes ?? 0}</TableCell>
                    <TableCell className="text-right">{r.pos ?? 0}</TableCell>
                    <TableCell className="text-right">{r.sos ?? 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <Card className="bg-card border border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="text-2xl font-semibold">
        {typeof value === "number" ? value.toLocaleString() : value}
      </CardContent>
    </Card>
  );
}

function DocPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border px-4 py-3 bg-background">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold mt-1">{value.toLocaleString()}</div>
    </div>
  );
}
