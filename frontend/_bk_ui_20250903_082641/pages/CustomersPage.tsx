import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Customer = { id:string; code:string; name:string; tax_no?:string; phone?:string; active:boolean };
const initial: Customer[] = [
  { id:"c1", code:"C001", name:"ACME Co.",  tax_no:"010555...", phone:"02-xxx", active:true },
  { id:"c2", code:"C002", name:"Beta Ltd.", tax_no:"010556...", phone:"02-yyy", active:true },
];

export default function CustomersPage() {
  const [rows,setRows]=useState(initial);
  const [q,setQ]=useState(""); const [editing,setEditing]=useState<Customer|null>(null);
  const [form,setForm]=useState<Customer>({id:"",code:"",name:"",tax_no:"",phone:"",active:true});
  const card="bg-card dark:bg-[#0f172a] border border-border dark:border-[#1f2937] shadow";
  const head="bg-secondary dark:bg-[#0e1626] text-muted-foreground";
  const list=useMemo(()=>{const s=q.toLowerCase().trim(); return s?rows.filter(r=>r.code.toLowerCase().includes(s)||r.name.toLowerCase().includes(s)):rows;},[rows,q]);

  function openCreate(){ setEditing(null); setForm({id:"",code:"",name:"",tax_no:"",phone:"",active:true}); }
  function openEdit(c:Customer){ setEditing(c); setForm({...c}); }
  function save(){ if(!form.code||!form.name){toast.error("กรอก Code/Name");return;}
    if(editing){ setRows(prev=>prev.map(r=>r.id===editing.id?{...form,id:editing.id}:r)); toast.success("บันทึกแล้ว"); }
    else{ setRows(prev=>[{...form,id:"c"+Date.now()},...prev]); toast.success("เพิ่มแล้ว"); }
    openCreate();
  }
  function remove(c:Customer){ if(!confirm(`ลบลูกค้า ${c.code}?`))return; setRows(prev=>prev.filter(r=>r.id!==c.id)); }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <Card className={card}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <span>ลูกค้า (Customers)</span>
            <div className="flex gap-2">
              <Input value={q} onChange={e=>setQ(e.target.value)} placeholder="ค้นหา code/ชื่อ…"
                     className="h-9 w-64 bg-background dark:bg-[#0b1220] border border-input text-foreground"/>
              <Button onClick={openCreate} className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus className="h-4 w-4 mr-1"/> เพิ่มลูกค้า
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-3"><Label className="text-muted-foreground">Code</Label>
            <Input value={form.code} onChange={e=>setForm(f=>({...f,code:e.target.value}))}
                   className="h-10 bg-background dark:bg-[#0b1220] border border-input text-foreground"/></div>
          <div className="md:col-span-5"><Label className="text-muted-foreground">Name</Label>
            <Input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}
                   className="h-10 bg-background dark:bg-[#0b1220] border border-input text-foreground"/></div>
          <div className="md:col-span-2"><Label className="text-muted-foreground">Tax No.</Label>
            <Input value={form.tax_no} onChange={e=>setForm(f=>({...f,tax_no:e.target.value}))}
                   className="h-10 bg-background dark:bg-[#0b1220] border border-input text-foreground"/></div>
          <div className="md:col-span-2"><Label className="text-muted-foreground">Phone</Label>
            <Input value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))}
                   className="h-10 bg-background dark:bg-[#0b1220] border border-input text-foreground"/></div>
          <div className="md:col-span-12 flex justify-end"><Button onClick={save}
                   className="bg-primary text-primary-foreground hover:bg-primary/90">{editing?"บันทึก":"เพิ่ม"}</Button></div>
        </CardContent>
      </Card>

      <Card className={card}>
        <CardHeader className="pb-3"><CardTitle>รายการลูกค้า</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border overflow-hidden">
            <Table className="bg-transparent">
              <TableHeader className={head}><TableRow>
                <TableHead className="w-[14%]">Code</TableHead>
                <TableHead className="w-[34%]">ชื่อลูกค้า</TableHead>
                <TableHead className="w-[18%]">Tax No.</TableHead>
                <TableHead className="w-[18%]">Phone</TableHead>
                <TableHead className="text-right w-[16%]">Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {list.length===0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">ไม่พบลูกค้า</TableCell></TableRow>
                ) : list.map(c=>(
                  <TableRow key={c.id} className="bg-transparent odd:dark:bg-[#0b1220]/30 hover:dark:bg-[#101826]">
                    <TableCell>{c.code}</TableCell><TableCell>{c.name}</TableCell>
                    <TableCell>{c.tax_no || "—"}</TableCell><TableCell>{c.phone || "—"}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" variant="secondary" className="bg-amber-500 text-black hover:bg-amber-600 ring-1 ring-white/10"
                              onClick={()=>openEdit(c)}><Pencil className="h-4 w-4 mr-1"/> แก้ไข</Button>
                      <Button size="sm" variant="secondary" className="bg-destructive text-destructive-foreground hover:bg-destructive/90 ring-1 ring-white/10"
                              onClick={()=>remove(c)}><Trash2 className="h-4 w-4 mr-1"/> ลบ</Button>
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

