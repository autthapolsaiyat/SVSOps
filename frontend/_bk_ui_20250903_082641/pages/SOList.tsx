import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useNavigate } from "react-router-dom";
import { CalendarDays, ClipboardList, Plus } from "lucide-react";

type Row = { id: string; no: string; customer: string; date: string; status: "Draft"|"Open"|"Approved" };

const mock: Row[] = [
  { id:"1", no:"SO-0001", customer:"ACME Co.", date:"2025-08-20", status:"Open" },
  { id:"2", no:"SO-0002", customer:"Beta Ltd.", date:"2025-08-19", status:"Draft" },
];

export default function SOList() {
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<""|"Draft"|"Open"|"Approved">("");
  const card = "bg-card dark:bg-[#0f172a] border border-border dark:border-[#1f2937] shadow";
  const head = "bg-secondary dark:bg-[#0e1626] text-muted-foreground";

  const rows = mock.filter(r =>
    (!q || r.no.toLowerCase().includes(q.toLowerCase()) || r.customer.toLowerCase().includes(q.toLowerCase())) &&
    (!status || r.status === status)
  );

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <Card className={card}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2"><ClipboardList className="h-5 w-5"/> รายการใบสั่งขาย</span>
            <div className="flex items-center gap-2">
              <Input value={q} onChange={e=>setQ(e.target.value)} placeholder="ค้นหาเลขที่/ลูกค้า…"
                     className="h-9 w-56 bg-background dark:bg-[#0b1220] border border-input text-foreground placeholder:text-muted-foreground"/>
              <select
                value={status}
                onChange={e=>setStatus(e.target.value as any)}
                className="h-9 rounded bg-background dark:bg-[#0b1220] border border-input text-foreground px-2"
              >
                <option value="">ทุกสถานะ</option>
                <option>Draft</option><option>Open</option><option>Approved</option>
              </select>
              <Button onClick={()=>nav("/sales-orders/new")}
                      className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus className="h-4 w-4 mr-1"/> สร้างใบสั่งขาย
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border overflow-hidden">
            <Table className="bg-transparent">
              <TableHeader className={head}>
                <TableRow>
                  <TableHead className="w-[18%]">เลขที่</TableHead>
                  <TableHead className="w-[34%]">ลูกค้า</TableHead>
                  <TableHead className="w-[20%]">สถานะ</TableHead>
                  <TableHead className="w-[20%]">วันที่</TableHead>
                  <TableHead className="text-right w-[8%]">เปิด</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">ยังไม่มีรายการ</TableCell></TableRow>
                ) : rows.map(r => (
                  <TableRow key={r.id} className="bg-transparent odd:dark:bg-[#0b1220]/30 hover:dark:bg-[#101826]">
                    <TableCell>{r.no}</TableCell>
                    <TableCell>{r.customer}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-0.5 rounded-full text-xs ring-1 ${
                        r.status==="Approved" ? "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30"
                        : r.status==="Open" ?   "bg-blue-500/15 text-blue-400 ring-blue-500/30"
                        :                         "bg-amber-500/15 text-amber-400 ring-amber-500/30"
                      }`}>{r.status}</span>
                    </TableCell>
                    <TableCell className="inline-flex items-center gap-1"><CalendarDays className="h-4 w-4 opacity-60"/>{r.date}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="secondary" className="bg-primary text-primary-foreground hover:bg-primary/90"
                              onClick={()=>nav(`/sales-orders/${r.id}`)}>เปิด</Button>
                    </TableCell>
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

