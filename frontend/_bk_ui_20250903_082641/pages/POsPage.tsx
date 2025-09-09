// FILE: src/pages/POsPage.tsx
import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { createPO, receivePO } from "@/lib/api.po";
import DocItemsEditor, { rowsToItems } from "@/components/DocItemsEditor";
import api from "@/lib/api.client";

const TEAMS = ["STD","PT","FSA","FSC","SP","SERV","APP","PTL","MI"];

export default function POsPage() {
  const [vendor, setVendor] = useState("");
  const [team, setTeam] = useState("");
  const [company, setCompany] = useState("SVS");
  const [rows, setRows] = useState<any[]>([]);
  const [poId, setPoId] = useState<string>(""); const [poNum, setPoNum] = useState<string>("");

  async function create() {
    try{
      const items = rowsToItems(rows);
      const po = await createPO({ vendor, team_code: team || undefined, company_code: company || undefined, items });
      setPoId(po.id); setPoNum(po.number);
      toast.success(`สร้าง PO: ${po.number}`);
    }catch(e:any){ toast.error(e?.message ?? "สร้าง PO ไม่สำเร็จ"); }
  }
  async function receiveApply() {
    try{
      const rv = await receivePO(poId);
      for (const m of rv.stock_moves) {
        await api.post("/inventory/receive", { sku: m.sku, wh: "MAIN", qty: m.qty, unit_cost: 0, ref: m.note, lot: null });
      }
      toast.success("Receive + Apply stock สำเร็จ");
    }catch(e:any){ toast.error(e?.message ?? "รับเข้าไม่สำเร็จ"); }
  }
  function printDoc(){ window.print(); }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Purchase Orders</h1>

      <div className="rounded-xl border border-border/60 bg-card/10 p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div><div className="text-sm opacity-70 mb-1">Vendor</div>
            <Input value={vendor} onChange={e=>setVendor(e.target.value)}/></div>
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
          <Button onClick={create}>สร้าง PO</Button>
          {poNum && (
            <>
              <span className="text-sm">เลขที่: <span className="font-mono">{poNum}</span></span>
              <Button variant="outline" onClick={receiveApply}>Receive + Apply</Button>
              <Button variant="outline" onClick={printDoc}>พิมพ์/Export PDF</Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

