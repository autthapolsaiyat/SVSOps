// FILE: src/pages/QuotationsPage.tsx
import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { createQuote } from "@/lib/api.quote";
import DocItemsEditor, { rowsToItems } from "@/components/DocItemsEditor";

const TEAMS = ["STD","PT","FSA","FSC","SP","SERV","APP","PTL","MI"];

export default function QuotationsPage() {
  const [customer, setCustomer] = useState("");
  const [team, setTeam] = useState("");
  const [company, setCompany] = useState("SVS");
  const [rows, setRows] = useState<any[]>([]);
  const [qid, setQid] = useState<string>(""); const [qnum,setQnum]=useState<string>("");

  async function create() {
    try{
      const items = rowsToItems(rows);
      const q = await createQuote({
        customer, team_code: team || undefined, company_code: company || undefined, items
      });
      setQid(q.id); setQnum(q.number);
      toast.success(`สร้าง Quotation: ${q.number}`);
    }catch(e:any){ toast.error(e?.message ?? "สร้าง Quotation ไม่สำเร็จ"); }
  }

  function printDoc(){
    window.print(); // ใช้ print-to-PDF ของเบราว์เซอร์
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">ใบเสนอราคา (Quotation)</h1>

      <div className="rounded-xl border border-border/60 bg-card/10 p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <div className="text-sm opacity-70 mb-1">ลูกค้า</div>
            <Input value={customer} onChange={e=>setCustomer(e.target.value)} placeholder="ชื่อลูกค้า"/>
          </div>
          <div>
            <div className="text-sm opacity-70 mb-1">ทีม</div>
            <select className="border rounded-md px-2 py-1 text-sm bg-transparent w-full" value={team} onChange={e=>setTeam(e.target.value)}>
              <option value="">(อิงทีมของผู้ใช้)</option>
              {TEAMS.map(t=> <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <div className="text-sm opacity-70 mb-1">บริษัท</div>
            <Input value={company} onChange={e=>setCompany(e.target.value.toUpperCase())}/>
          </div>
        </div>

        <div className="mt-4">
          <DocItemsEditor value={rows} onChange={setRows}/>
        </div>

        <div className="flex items-center gap-2 mt-3">
          <Button onClick={create}>สร้างใบเสนอราคา</Button>
          {qnum && (
            <>
              <span className="text-sm">เลขที่: <span className="font-mono">{qnum}</span></span>
              <Button variant="outline" onClick={printDoc}>พิมพ์/Export PDF</Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

