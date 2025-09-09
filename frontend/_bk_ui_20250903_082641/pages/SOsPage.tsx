// FILE: src/pages/SOsPage.tsx
import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { createSO, fulfillSO } from "@/lib/api.so";
import DocItemsEditor, { rowsToItems } from "@/components/DocItemsEditor";
import api from "@/lib/api.client";

const TEAMS = ["STD","PT","FSA","FSC","SP","SERV","APP","PTL","MI"];

export default function SOsPage() {
  const [customer, setCustomer] = useState("");
  const [team, setTeam] = useState("");
  const [company, setCompany] = useState("SVS");
  const [rows, setRows] = useState<any[]>([]);
  const [soId, setSoId] = useState<string>(""); const [soNum, setSoNum] = useState<string>("");

  async function create() {
    try{
      const items = rowsToItems(rows);
      const so = await createSO({ customer, team_code: team || undefined, company_code: company || undefined, items });
      setSoId(so.id); setSoNum(so.number);
      toast.success(`สร้าง SO: ${so.number}`);
    }catch(e:any){ toast.error(e?.message ?? "สร้าง SO ไม่สำเร็จ"); }
  }
  async function fulfillApply() {
    try{
      const ff = await fulfillSO(soId);
      for (const m of ff.stock_moves) {
        await api.post("/inventory/issue", { sku: m.sku, wh: "MAIN", qty: Math.abs(m.qty), ref: m.note });
      }
      toast.success("Fulfill + Apply stock สำเร็จ");
    }catch(e:any){ toast.error(e?.message ?? "Fulfill ไม่สำเร็จ"); }
  }
  function printDoc(){ window.print(); }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Sales Orders</h1>

      <div className="rounded-xl border border-border/60 bg-card/10 p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div><div className="text-sm opacity-70 mb-1">ลูกค้า</div>
            <Input value={customer} onChange={e=>setCustomer(e.target.value)}/></div>
          <div><div className="text-sm opacity-70 mb-1">ทีม</div>
            <select className="border rounded-md px-2 py-1 text-sm bg-transparent w-full" value={team} onChange={e=>setTeam(e.target.value)}>
              <option value="">(อิงทีมของผู้ใช้)</option>
              {TEAMS.map(t=> <option key={t} value={t}>{t}</option>)}
            </select></div>
          <div><div className="text-sm opacity-70 mb-1">บริษัท</div>
            <Input value={company} onChange={e=>setCompany(e.target.value.toUpperCase())}/></div>
        </div>

        <DocItemsEditor value={rows} onChange={setRows}/>

        <div className="flex items-center gap-2 mt-3">
          <Button onClick={create}>สร้าง SO</Button>
          {soNum && (
            <>
              <span className="text-sm">เลขที่: <span className="font-mono">{soNum}</span></span>
              <Button variant="outline" onClick={fulfillApply}>Fulfill + Apply</Button>
              <Button variant="outline" onClick={printDoc}>พิมพ์/Export PDF</Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

