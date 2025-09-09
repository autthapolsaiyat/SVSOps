// FILE: src/pages/SalesRepsPage.tsx
import React, { useEffect, useState } from "react";
import { listSalesReps, upsertSalesRep, type SalesRepRow } from "@/lib/api.salesreps";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function SalesRepsPage() {
  const [rows, setRows] = useState<SalesRepRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");

  async function load() {
    setLoading(true);
    try {
      const data = await listSalesReps();
      setRows(data);
    } catch (e:any) {
      toast.error(e?.message ?? "โหลดผู้ขายไม่สำเร็จ");
    } finally { setLoading(false); }
  }

  useEffect(()=>{ load(); },[]);

  const view = rows.filter(r => {
    const s = (q||"").trim().toLowerCase();
    if (!s) return true;
    return [r.username, r.full_name, r.rep_email, r.user_email].some(v => (v||"").toLowerCase().includes(s));
  });

  async function saveOne(r: SalesRepRow) {
    const full_name = r.full_name?.toString().trim() || r.username;
    try {
      await upsertSalesRep(r.user_id, {
        full_name,
        phone: r.phone || undefined,
        email: r.rep_email || undefined,
      });
      toast.success(`บันทึกผู้ขาย: ${r.username}`);
      load();
    } catch(e:any){
      toast.error(e?.message ?? "บันทึกไม่สำเร็จ");
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">ผู้ขาย (Sales Reps)</h1>
        <div className="flex items-center gap-2">
          <Input placeholder="ค้นหา username/ชื่อ/อีเมล" value={q} onChange={e=>setQ(e.target.value)} className="w-64"/>
          <Button variant="outline" onClick={load} disabled={loading}>{loading?"กำลังโหลด...":"รีเฟรช"}</Button>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-card/10 p-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left opacity-70">
              <th className="p-2">ผู้ใช้</th>
              <th className="p-2">ชื่อจริง (แสดงในเอกสาร)</th>
              <th className="p-2">โทร</th>
              <th className="p-2">อีเมลผู้ขาย</th>
              <th className="p-2">อีเมลระบบ</th>
              <th className="p-2 w-[120px]">บันทึก</th>
            </tr>
          </thead>
          <tbody>
            {view.map((r,idx)=>(
              <tr key={r.user_id} className="border-t border-border/40">
                <td className="p-2 font-mono">{r.username}</td>
                <td className="p-2"><Input value={r.full_name ?? ""} onChange={e=>{
                  const v=[...rows]; v.find(x=>x.user_id===r.user_id)!.full_name = e.target.value; setRows(v);
                }}/></td>
                <td className="p-2"><Input value={r.phone ?? ""} onChange={e=>{
                  const v=[...rows]; v.find(x=>x.user_id===r.user_id)!.phone = e.target.value; setRows(v);
                }}/></td>
                <td className="p-2"><Input value={r.rep_email ?? ""} onChange={e=>{
                  const v=[...rows]; v.find(x=>x.user_id===r.user_id)!.rep_email = e.target.value; setRows(v);
                }}/></td>
                <td className="p-2">{r.user_email ?? "-"}</td>
                <td className="p-2">
                  <Button size="sm" onClick={()=>saveOne(r)}>บันทึก</Button>
                </td>
              </tr>
            ))}
            {!loading && view.length===0 && <tr><td className="p-2 opacity-60" colSpan={6}>ไม่พบข้อมูล</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

