import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getLevels, LevelRow, buildReportUrl } from "@/lib/stock.api";

function todayIso() {
  const d = new Date();
  const mm = String(d.getMonth()+1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export default function StockLevelsPage() {
  const [sku, setSku] = useState("");
  const [wh, setWh] = useState("MAIN");
  const [rows, setRows] = useState<LevelRow[] | null>(null);

  async function search() {
    const data = await getLevels({ sku, wh });
    setRows(data);
  }

  const asOf = todayIso();

  return (
    <div className="p-6 space-y-4">
      <section className="app-section max-w-2xl">
        <h2 className="text-lg font-semibold mb-3">ตรวจยอดคงเหลือ (Levels)</h2>
        <div className="flex gap-2">
          <Input placeholder="SKU" value={sku} onChange={(e)=>setSku(e.target.value)} />
          <Input placeholder="WH (เช่น MAIN)" value={wh} onChange={(e)=>setWh(e.target.value)} />
          <Button onClick={search} disabled={!sku}>ค้นหา</Button>
        </div>
      </section>

      {rows && (
        <section className="app-section max-w-2xl">
          <h3 className="text-base font-medium mb-2">ผลลัพธ์</h3>
          <div className="space-y-2">
            {rows.length === 0 && <div className="text-sm opacity-70">ไม่พบข้อมูล</div>}
            {rows.map((r) => (
              <div key={r.sku} className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
                <div>
                  <div className="font-medium">{r.sku}</div>
                  <div className="text-xs opacity-70">on_hand: {r.on_hand} | reserved: {r.reserved}</div>
                </div>
                <div className="flex gap-3 text-sm underline">
                  <a href={buildReportUrl("balance", { as_of: asOf, sku: r.sku, wh })} target="_blank" rel="noreferrer">Balance CSV</a>
                  <a href={buildReportUrl("valuation", { as_of: asOf, sku: r.sku, wh })} target="_blank" rel="noreferrer">Valuation CSV</a>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

