// FILE: src/components/DocItemsEditor.tsx
import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { listProducts, type ProductList, type Product } from "@/lib/api.products";

type Row = { product?: Product; sku: string; name: string; qty: number; price: number };

export default function DocItemsEditor({
  value,
  onChange,
}: {
  value: Row[];
  onChange: (rows: Row[]) => void;
}) {
  const [rows, setRows] = useState<Row[]>(value.length ? value : [{ sku: "", name: "", qty: 1, price: 0 }]);

  function update(i: number, patch: Partial<Row>) {
    const next = [...rows];
    next[i] = { ...next[i], ...patch };
    setRows(next);
    onChange(next);
  }
  function add() {
    const next = [...rows, { sku: "", name: "", qty: 1, price: 0 }];
    setRows(next); onChange(next);
  }
  function rm(i: number) {
    const next = rows.filter((_, idx) => idx !== i);
    setRows(next); onChange(next);
  }
  async function pick(i: number) {
    const sku = rows[i].sku.trim();
    if (!sku) return;
    try {
      const res: ProductList = await listProducts({ q: sku, page: 1, per_page: 5 });
      const p = res.items?.[0];
      if (!p) { toast.error("ไม่พบสินค้า"); return; }
      update(i, { product: p, sku: p.sku, name: p.name, price: Number(p.price_ex_vat || 0) });
    } catch {
      toast.error("ค้นหาสินค้าไม่สำเร็จ");
    }
  }

  const total = rows.reduce((s, r) => s + (Number(r.qty) || 0) * (Number(r.price) || 0), 0);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-12 gap-2 text-sm opacity-70">
        <div className="col-span-3">SKU</div>
        <div className="col-span-5">ชื่อสินค้า</div>
        <div className="col-span-2 text-right">จำนวน</div>
        <div className="col-span-2 text-right">ราคา/หน่วย</div>
      </div>
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-12 gap-2 items-center">
          <div className="col-span-3 flex gap-2">
            <Input value={r.sku} onChange={e=>update(i,{sku:e.target.value})} placeholder="พิมพ์ SKU แล้วกดเลือก"/>
            <Button variant="outline" onClick={()=>pick(i)}>เลือก</Button>
          </div>
          <div className="col-span-5">
            <Input value={r.name} onChange={e=>update(i,{name:e.target.value})} placeholder="ชื่อสินค้า"/>
          </div>
          <div className="col-span-2">
            <Input type="number" inputMode="numeric" value={r.qty} className="text-right"
              onChange={e=>update(i,{qty: Number(e.target.value)})}/>
          </div>
          <div className="col-span-2">
            <Input type="number" inputMode="decimal" value={r.price} className="text-right"
              onChange={e=>update(i,{price: Number(e.target.value)})}/>
          </div>
          <div className="col-span-12 text-right">
            <Button variant="ghost" size="sm" onClick={()=>rm(i)}>ลบแถว</Button>
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={add}>+ เพิ่มรายการ</Button>
        <div className="text-right font-medium">รวม (ก่อน VAT): {total.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
      </div>
    </div>
  );
}

// ใช้แปลงเป็น payload items
export function rowsToItems(rows: ReturnType<typeof Array.prototype.map>) {
  return (rows as Row[])
    .filter(r => r.product?.id && r.qty>0)
    .map(r => ({ product_id: r.product!.id, qty: r.qty, price_ex_vat: r.price }));
}

