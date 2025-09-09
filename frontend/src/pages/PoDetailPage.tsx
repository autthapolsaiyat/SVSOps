import React,{useEffect,useState} from "react";
import { useParams } from "react-router-dom";
import { getPO, receivePO } from "@/lib/api.po";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function PoDetailPage(){
  const { id="" } = useParams();
  const [po,setPo]=useState<any>(null); const [busy,setBusy]=useState(false);
  useEffect(()=>{ (async()=>{ try{ setPo(await getPO(id)); }catch(e:any){ toast.error(e?.message||"โหลด PO ไม่สำเร็จ"); } })(); },[id]);

  async function doReceiveAll(){
    try{
      setBusy(true);
      // payload ตัวอย่างทั่วไป: ปรับให้ตรง schema หาก API ของคุณต้องการรูปแบบเฉพาะ
      const payload = { ref:`PO-RECV-${id}`, note:"receive all from UI" };
      await receivePO(id, payload);
      toast.success("รับเข้าตาม PO แล้ว");
    }catch(e:any){ toast.error(e?.message||"รับเข้าตาม PO ไม่สำเร็จ"); }
    finally{ setBusy(false); }
  }

  const lines = Array.isArray(po?.items)? po.items : (po?.lines || []);
  return (
    <div className="p-6 space-y-4">
      <section className="app-section">
        <h2 className="text-lg font-semibold mb-3">PO #{po?.po_no || id}</h2>
        <div className="text-sm opacity-80 mb-3">ผู้ขาย: {po?.supplier_name || po?.vendor || "-"}</div>
        <table className="w-full">
          <thead><tr className="text-sm opacity-70"><th className="text-left py-1">SKU</th><th>ชื่อ</th><th className="text-right">จำนวน</th></tr></thead>
          <tbody>
            {lines.map((l:any,idx:number)=>(
              <tr key={idx} className="border-t border-border">
                <td className="py-1">{l.sku || l.product_sku || "-"}</td>
                <td>{l.name || l.product_name || "-"}</td>
                <td className="text-right">{l.qty || l.quantity || "-"}</td>
              </tr>
            ))}
            {lines.length===0 && <tr><td colSpan={3} className="text-center py-6 opacity-70">ไม่มีรายการ</td></tr>}
          </tbody>
        </table>
        <div className="mt-3">
          <Button onClick={doReceiveAll} disabled={busy}>{busy ? "กำลังรับเข้า..." : "รับเข้าตาม PO (ทั้งหมด)"}</Button>
        </div>
      </section>
    </div>
  );
}

