// FILE: src/components/product/ItemsTable.tsx
import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus } from "lucide-react";

export type ItemRow = { id: string; sku: string; name: string; unit: string; qty: number; price: number };
export default function ItemsTable({
  items, onChange, onPickProduct,
}: {
  items: ItemRow[];
  onChange: (rows: ItemRow[]) => void;
  onPickProduct?: (rowIndex: number) => void; // เปิด ProductPicker แล้วเติม
}) {
  const head = "bg-secondary dark:bg-[#0e1626] text-muted-foreground";
  const total = items.reduce((s,r)=> s + r.qty*r.price, 0);

  function addRow() {
    onChange([...items, { id: String(Date.now()), sku:"", name:"", unit:"ชิ้น", qty:1, price:0 }]);
  }
  function patch(i:number, p:Partial<ItemRow>) {
    onChange(items.map((r,idx)=> idx===i ? { ...r, ...p } : r));
  }
  function remove(i:number) {
    onChange(items.filter((_,idx)=> idx!==i));
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <Table className="bg-transparent">
        <TableHeader className={head}>
          <TableRow>
            <TableHead className="w-[18%]">รหัสสินค้า</TableHead>
            <TableHead className="w-[30%]">ชื่อสินค้า</TableHead>
            <TableHead className="w-[10%]">หน่วย</TableHead>
            <TableHead className="w-[12%]">จำนวน</TableHead>
            <TableHead className="w-[12%]">ราคา</TableHead>
            <TableHead className="w-[12%]">รวม</TableHead>
            <TableHead className="text-right w-[6%]">ลบ</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length===0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                ยังไม่มีรายการ <Button className="ml-2 bg-primary text-primary-foreground" onClick={addRow}><Plus className="h-4 w-4 mr-1"/> เพิ่มแถว</Button>
              </TableCell>
            </TableRow>
          ) : items.map((r,i)=>(
            <TableRow key={r.id} className="bg-transparent odd:dark:bg-[#0b1220]/30 hover:dark:bg-[#101826]">
              <TableCell>
                <div className="flex gap-2">
                  <Input value={r.sku} onChange={e=>patch(i,{sku:e.target.value})}
                         className="h-9 bg-background dark:bg-[#0b1220] border border-input text-foreground"/>
                  {onPickProduct && (
                    <Button size="sm" className="bg-primary text-primary-foreground" onClick={()=>onPickProduct(i)}>เลือก</Button>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <Input value={r.name} onChange={e=>patch(i,{name:e.target.value})}
                       className="h-9 bg-background dark:bg-[#0b1220] border border-input text-foreground"/>
              </TableCell>
              <TableCell>
                <Input value={r.unit} onChange={e=>patch(i,{unit:e.target.value})}
                       className="h-9 bg-background dark:bg-[#0b1220] border border-input text-foreground"/>
              </TableCell>
              <TableCell>
                <Input type="number" value={r.qty} onChange={e=>patch(i,{qty:Number(e.target.value||0)})}
                       className="h-9 bg-background dark:bg-[#0b1220] border border-input text-foreground"/>
              </TableCell>
              <TableCell>
                <Input type="number" value={r.price} onChange={e=>patch(i,{price:Number(e.target.value||0)})}
                       className="h-9 bg-background dark:bg-[#0b1220] border border-input text-foreground"/>
              </TableCell>
              <TableCell>{(r.qty*r.price).toLocaleString()}</TableCell>
              <TableCell className="text-right">
                <Button size="sm" variant="secondary" className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={()=>remove(i)}><Trash2 className="h-4 w-4 mr-1"/> ลบ</Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {items.length>0 && (
        <div className="flex justify-end px-3 py-2 text-sm">
          <div className="px-3 py-1 rounded bg-primary/10 text-primary ring-1 ring-primary/20">
            รวมทั้งสิ้น: <b>{total.toLocaleString()}</b>
          </div>
        </div>
      )}
    </div>
  );
}

