import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { receiveStock, issueStock } from "@/lib/stock.api";
import { toast } from "sonner";

export default function StockConsolePage() {
  const [sku, setSku] = useState("");
  const [wh, setWh] = useState("MAIN");
  const [qty, setQty] = useState<number>(1);
  const [cost, setCost] = useState<number>(0);

  const canReceive = !!sku && !!wh && qty > 0 && cost >= 0;
  const canIssue = !!sku && !!wh && qty > 0;

  const doReceive = async () => {
    try { await receiveStock({ sku, wh, qty, unit_cost: cost, ref: "UI-RECV" }); toast.success(`รับเข้า ${sku} +${qty}`); }
    catch (e: any) { toast.error(e?.message || "รับเข้าไม่สำเร็จ"); }
  };
  const doIssue = async () => {
    try { await issueStock({ sku, wh, qty, ref: "UI-ISSUE" }); toast.success(`ตัดออก ${sku} -${qty}`); }
    catch (e: any) { toast.error(e?.message || "ตัดออกไม่สำเร็จ"); }
  };

  return (
    <div className="p-6 grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Receive (รับเข้า)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="SKU" value={sku} onChange={(e)=>setSku(e.target.value)} />
          <Input placeholder="WH (เช่น MAIN)" value={wh} onChange={(e)=>setWh(e.target.value)} />
          <Input type="number" placeholder="QTY" value={qty} onChange={(e)=>setQty(+e.target.value)} />
          <Input type="number" placeholder="Unit Cost" value={cost} onChange={(e)=>setCost(+e.target.value)} />
          <Button onClick={doReceive} disabled={!canReceive}>Receive</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Issue (ตัดออก)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="SKU" value={sku} onChange={(e)=>setSku(e.target.value)} />
          <Input placeholder="WH (เช่น MAIN)" value={wh} onChange={(e)=>setWh(e.target.value)} />
          <Input type="number" placeholder="QTY" value={qty} onChange={(e)=>setQty(+e.target.value)} />
          <Button variant="destructive" onClick={doIssue} disabled={!canIssue}>Issue</Button>
        </CardContent>
      </Card>
    </div>
  );
}

