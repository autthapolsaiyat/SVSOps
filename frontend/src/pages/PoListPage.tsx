import React,{useEffect,useState} from "react";
import { listPO } from "@/lib/api.po";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function PoListPage(){
  const nav=useNavigate();
  const [q,setQ]=useState(""); const [rows,setRows]=useState<any[]>([]); const [page,setPage]=useState(0);
  const limit=20;
  async function load(){ const data=await listPO({q,limit,offset:page*limit}); setRows(Array.isArray(data?.items)?data.items: (Array.isArray(data)?data:[])); }
  useEffect(()=>{ load(); /* eslint-disable-next-line */ },[page]);
  return (
    <div className="p-6">
      <section className="app-section">
        <div className="flex items-center gap-2 mb-3">
          <Input placeholder="ค้นหา PO" value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>{ if(e.key==="Enter"){ setPage(0); load(); }}} />
          <Button onClick={()=>{ setPage(0); load(); }}>ค้นหา</Button>
        </div>
        <table className="w-full">
          <thead><tr className="text-sm opacity-70"><th className="text-left py-1">PO No</th><th className="text-left">Supplier</th><th className="text-left">Status</th><th></th></tr></thead>
          <tbody>
            {rows.map((r:any,idx:number)=>(
              <tr key={idx} className="border-t border-border">
                <td className="py-1">{r.po_no || r.code || r.id}</td>
                <td>{r.supplier_name || r.vendor || "-"}</td>
                <td>{r.status || "-"}</td>
                <td className="text-right"><Button size="sm" variant="outline" onClick={()=>nav(`/po/${encodeURIComponent(r.id||r.po_id||r.po_no)}`)}>เปิด</Button></td>
              </tr>
            ))}
            {rows.length===0 && <tr><td colSpan={4} className="text-center py-6 opacity-70">ไม่พบข้อมูล</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}

