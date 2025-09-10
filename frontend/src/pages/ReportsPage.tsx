import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function today() {
  const d = new Date(); const mm = String(d.getMonth()+1).padStart(2,"0"); const dd = String(d.getDate()).padStart(2,"0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}
async function fetchCSV(url: string) {
  const res = await fetch(url, { headers: { Accept: "text/csv" } });
  if (!res.ok) throw new Error(await res.text());
  return await res.text();
}
function parseCSV(text: string) {
  const lines = text.trim().split(/\r?\n/);
  if (!lines.length) return { header: [], rows: [] as string[][] };
  const header = lines[0].split(",");
  const rows = lines.slice(1).map(l => l.split(","));
  return { header, rows };
}

export default function ReportsPage() {
  const [asOf, setAsOf] = useState(today());
  const [sku, setSku] = useState("");
  const [wh, setWh] = useState("");
  const [bal, setBal] = useState<{header:string[],rows:string[][]}|null>(null);
  const [val, setVal] = useState<{header:string[],rows:string[][]}|null>(null);
  const [busy, setBusy] = useState(false);

  const base = "/api/reports/stock";

  async function load(kind: "balance"|"valuation") {
    setBusy(true);
    try {
      const u = new URL(`${base}/${kind}`, window.location.origin);
      u.searchParams.set("as_of", `${asOf}T23:59:59Z`);
      if (sku) u.searchParams.set("sku", sku);
      if (wh) u.searchParams.set("wh", wh);
      const text = await fetchCSV(u.toString());
      const parsed = parseCSV(text);
      if (kind==="balance") setBal(parsed); else setVal(parsed);
    } catch (e:any) { console.error(e); }
    finally { setBusy(false); }
  }
  function exportUrl(kind:"balance"|"valuation") {
    const u = new URL(`${base}/${kind}`, window.location.origin);
    u.searchParams.set("as_of", `${asOf}T23:59:59Z`);
    if (sku) u.searchParams.set("sku", sku);
    if (wh) u.searchParams.set("wh", wh);
    return u.toString();
  }

  return (
    <div className="p-6 space-y-4">
      <section className="app-section">
        <h2 className="text-lg font-semibold mb-3">Reports</h2>
        <div className="grid sm:grid-cols-[160px_1fr_1fr_auto_auto] gap-2">
          <Input type="date" value={asOf} onChange={(e)=>setAsOf(e.target.value)} />
          <Input placeholder="SKU (optional)" value={sku} onChange={(e)=>setSku(e.target.value)} />
          <Input placeholder="WH (optional)" value={wh} onChange={(e)=>setWh(e.target.value)} />
          <Button onClick={()=>load("balance")} disabled={busy}>ดู Balance</Button>
          <Button onClick={()=>load("valuation")} disabled={busy}>ดู Valuation</Button>
        </div>
      </section>

      {bal && (
        <section className="app-section overflow-auto">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium">Balance (preview)</h3>
            <a className="underline text-sm" href={exportUrl("balance")} target="_blank" rel="noreferrer">Export CSV</a>
          </div>
          <table className="min-w-[720px] w-full">
            <thead><tr>{bal.header.map((h,i)=><th key={i} className="text-left py-1">{h}</th>)}</tr></thead>
            <tbody>
              {bal.rows.slice(0,50).map((r,idx)=>(
                <tr key={idx} className="border-t border-border">{r.map((c,i)=><td key={i} className="py-1 pr-3">{c}</td>)}</tr>
              ))}
            </tbody>
          </table>
          <div className="text-xs opacity-70 mt-1">* แสดงตัวอย่าง 50 แถวแรก</div>
        </section>
      )}

      {val && (
        <section className="app-section overflow-auto">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium">Valuation (preview)</h3>
            <a className="underline text-sm" href={exportUrl("valuation")} target="_blank" rel="noreferrer">Export CSV</a>
          </div>
          <table className="min-w-[720px] w-full">
            <thead><tr>{val.header.map((h,i)=><th key={i} className="text-left py-1">{h}</th>)}</tr></thead>
            <tbody>
              {val.rows.slice(0,50).map((r,idx)=>(
                <tr key={idx} className="border-t border-border">{r.map((c,i)=><td key={i} className="py-1 pr-3">{c}</td>)}</tr>
              ))}
            </tbody>
          </table>
          <div className="text-xs opacity-70 mt-1">* แสดงตัวอย่าง 50 แถวแรก</div>
        </section>
      )}
    </div>
  );
}

