import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getLevels, LevelRow, buildReportUrl } from "@/lib/stock.api";

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = `${d.getMonth()+1}`.padStart(2,"0");
  const dd = `${d.getDate()}`.padStart(2,"0");
  return `${y}-${m}-${dd}`;
}

export default function StockLevelsPage() {
  const [sku, setSku] = useState("");
  const [wh, setWh] = useState("MAIN");
  const [rows, setRows] = useState<LevelRow[]|null>(null);

  const search = async () => {
    const data = await getLevels({ sku, wh });
    setRows(data);
  };

  const asOf = todayIso();

  return (
    <div className="p-6 space-y-4">
      <Card className="max-w-2xl">
        <CardHeader><CardTitle>ตรวจยอดคงเหลือ (Levels)</CardTitle></CardHeader>
        <CardContent className="flex gap-2">
          <Input placeholder="SKU" value={sku} onChange={(e)=>setSku(e.target.value)} />
          <Input placeholder="WH (เช่น MAIN)" value={wh} onChange={(e)=>setWh(e.target.value)} />
          <Button onClick={search} disabled={!sku}>ค้นหา</Button>
        </CardContent>
      </Card>

      {rows && (
        <Card className="max-w-2xl">
          <CardHeader><CardTitle>ผลลัพธ์</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {rows.length === 0 && <div className="text-sm">ไม่พบข้อมูล</div>}
            {rows.map(r => (
              <div key={r.sku} className="flex items-center justify-between border rounded p-2">
                <div>
                  <div className="font-medium">{r.sku}</div>
                  <div className="text-xs text-muted-foreground">
                    on_hand: {r.on_hand} | reserved: {r.reserved}
                  </div>
                </div>
                <div className="flex gap-3 text-sm underline">
                  <a href={buildReportUrl("balance",   { as_of: asOf, sku: r.sku, wh })} target="_blank" rel="noreferrer">Balance CSV</a>
                  <a href={buildReportUrl("valuation", { as_of: asOf, sku: r.sku, wh })} target="_blank" rel="noreferrer">Valuation CSV</a>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

