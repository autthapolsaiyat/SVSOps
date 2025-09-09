import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getStockCard, StockCardRow } from "@/lib/stock.api";

const NEG = /^(OUT|ISS|TRN-OUT|ADJ-)/i;

function today() {
  const d = new Date();
  const mm = String(d.getMonth()+1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export default function StockCardPage() {
  const [sku, setSku] = useState("");
  const [wh, setWh] = useState("MAIN");
  const [df, setDf] = useState("");
  const [dt, setDt] = useState(today());
  const [rows, setRows] = useState<StockCardRow[]|null>(null);
  const [busy, setBusy] = useState(false);

  async function search() {
    if (!sku) return;
    setBusy(true);
    try {
      const items = await getStockCard({
        sku, wh: wh || undefined,
        date_from: df || undefined,
        date_to: dt || undefined,
        limit: 5000,
      });
      setRows(items);
    } finally { setBusy(false); }
  }

  const signed = (r: StockCardRow) => (NEG.test(r.move_type) ? -1 : 1) * (r.qty ?? 0);
  let balance = 0;
  const display = (rows ?? []).map((r) => {
    const s = signed(r);
    balance += s;
    return { ...r, signed: s, balance };
  });

  const csvHref = () => {
    const u = new URL("/api/stock/card", window.location.origin);
    u.searchParams.set("sku", sku);
    if (wh) u.searchParams.set("wh", wh);
    if (df) u.searchParams.set("date_from", df);
    if (dt) u.searchParams.set("date_to", dt);
    u.searchParams.set("limit", "5000");
    u.searchParams.set("format", "csv");
    return u.toString();
  };

  return (
    <div className="p-6 space-y-4">
      <section className="app-section">
        <h2 className="text-lg font-semibold mb-3">Stock Card</h2>
        <div className="grid sm:grid-cols-[1fr_140px_160px_160px_auto_auto] gap-2">
          <Input placeholder="SKU" value={sku} onChange={(e)=>setSku(e.target.value)} />
          <Input placeholder="WH (เช่น MAIN)" value={wh} onChange={(e)=>setWh(e.target.value)} />
          <Input type="date" value={df} onChange={(e)=>setDf(e.target.value)} />
          <Input type="date" value={dt} onChange={(e)=>setDt(e.target.value)} />
          <Button onClick={search} disabled={!sku || busy}>{busy ? "Loading..." : "ค้นหา"}</Button>
          {rows && <a className="underline text-sm self-center" href={csvHref()} target="_blank" rel="noreferrer">Export CSV</a>}
        </div>
      </section>

      {rows && (
        <section className="app-section overflow-auto">
          <table className="min-w-[820px] w-full">
            <thead>
              <tr className="text-sm opacity-70">
                <th className="text-left py-2">วันที่</th>
                <th className="text-left">ประเภท</th>
                <th className="text-left">WH</th>
                <th className="text-right">จำนวน (+/−)</th>
                <th className="text-right">ต้นทุน/หน่วย</th>
                <th className="text-right">คงเหลือ</th>
                <th className="text-left">อ้างอิง</th>
              </tr>
            </thead>
            <tbody>
              {display.map((r, idx) => (
                <tr key={idx} className="border-t border-border">
                  <td className="py-1">{r.moved_at}</td>
                  <td>{r.move_type}</td>
                  <td>{r.wh ?? "-"}</td>
                  <td className={`text-right ${r.signed<0 ? "text-red-400" : "text-emerald-400"}`}>
                    {r.signed.toLocaleString()}
                  </td>
                  <td className="text-right">{(r.unit_cost ?? 0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
                  <td className="text-right">{r.balance.toLocaleString()}</td>
                  <td>{r.ref ?? r.note ?? "-"}</td>
                </tr>
              ))}
              {display.length === 0 && (
                <tr><td colSpan={7} className="text-center py-6 opacity-70">ไม่พบข้อมูล</td></tr>
              )}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

