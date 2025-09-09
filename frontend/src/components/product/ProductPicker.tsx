// FILE: src/components/product/ProductPicker.tsx
import React, { useMemo, useState } from "react";
import { X, Search, ShoppingCart } from "lucide-react";

export type ProductLite = { id: string; sku: string; name: string; unit: string; price: number };

const MOCK: ProductLite[] = [
  { id:"p1", sku:"SKU-001", name:"สินค้า A", unit:"ชิ้น", price:120 },
  { id:"p2", sku:"SKU-002", name:"สินค้า B", unit:"ชิ้น", price:250 },
  { id:"p3", sku:"SKU-003", name:"บริการ C", unit:"ครั้ง", price:500 },
];

export default function ProductPicker({
  open, onClose, onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (p: ProductLite) => void;
}) {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return MOCK;
    return MOCK.filter(r => r.sku.toLowerCase().includes(s) || r.name.toLowerCase().includes(s));
  }, [q]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60" onClick={onClose}/>
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[720px] max-w-[95vw]
                      rounded-xl bg-card dark:bg-[#0f172a] border border-border dark:border-[#1f2937] shadow">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2"><ShoppingCart className="h-5 w-5"/><b>เลือกสินค้า</b></div>
          <button className="opacity-70 hover:opacity-100" onClick={onClose}><X className="h-5 w-5"/></button>
        </div>
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 opacity-60"/>
              <input
                value={q} onChange={e=>setQ(e.target.value)} placeholder="ค้นหา SKU/ชื่อ…"
                className="w-full h-10 pl-8 pr-3 rounded border border-input bg-background dark:bg-[#0b1220] text-foreground"
              />
            </div>
          </div>
          <div className="max-h-[50vh] overflow-auto rounded border border-border">
            <table className="w-full text-sm">
              <thead className="bg-secondary dark:bg-[#0e1626] text-muted-foreground">
                <tr><th className="text-left px-3 py-2">SKU</th><th className="text-left px-3 py-2">ชื่อสินค้า</th>
                    <th className="text-left px-3 py-2">หน่วย</th><th className="text-left px-3 py-2">ราคา</th>
                    <th className="text-right px-3 py-2">เลือก</th></tr>
              </thead>
              <tbody>
                {list.map(p=>(
                  <tr key={p.id} className="odd:dark:bg-[#0b1220]/30 hover:dark:bg-[#101826]">
                    <td className="px-3 py-2">{p.sku}</td>
                    <td className="px-3 py-2">{p.name}</td>
                    <td className="px-3 py-2">{p.unit}</td>
                    <td className="px-3 py-2">{p.price.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right">
                      <button className="px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90"
                              onClick={()=>{ onPick(p); onClose(); }}>
                        เลือก
                      </button>
                    </td>
                  </tr>
                ))}
                {list.length===0 && (
                  <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">ไม่พบสินค้า</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

