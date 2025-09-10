import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2, UsersRound } from "lucide-react";
import { toast } from "sonner";

type Group = { id:string; name:string; description?:string; members:number };
const initial: Group[] = [
  { id:"g1", name:"ฝ่ายขาย A", description:"ภาคกลาง", members:5 },
  { id:"g2", name:"ฝ่ายขาย B", description:"ภาคเหนือ", members:3 },
];

export default function StaffGroupsPage() {
  const [rows,setRows]=useState(initial);
  const [q,setQ]=useState("");
  const [editing,setEditing]=useState<Group|null>(null);
  const [form,setForm]=useState<Group>({id:"",name:"",description:"",members:0});

  const card="bg-card dark:bg-[#0f172a] border border-border dark:border-[#1f2937] shadow";
  const head="bg-secondary dark:bg-[#0e1626] text-muted-foreground";
  const list=useMemo(()=>{const s=q.toLowerCase().trim(); return s?rows.filter(r=>r.name.toLowerCase().includes(s)):rows;},[rows,q]);

  function openCreate(){ setEditing(null); setForm({id:"",name:"",description:"",members:0}); }
  function openEdit(g:Group){ setEditing(g); setForm({...g}); }
  function save(){ if(!form.name){toast.error("กรอกชื่อกลุ่ม");return;}
    if(editing){ setRows(prev=>prev.map(r=>r.id===editing.id?{...form,id:editing.id}:r)); toast.success("บันทึกแล้ว"); }
    else{ setRows(prev=>[{...form,id:"g"+Date.now()},...prev]); toast.success("เพิ่มแล้ว"); }
    openCreate();
  }
  function remove(g:Group){ if(!confirm(`ลบกลุ่ม ${g.name}?`))return; setRows(prev=>prev.filter(r=>r.id!==g.id)); }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <Card className={card}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2"><UsersRound className="h-5 w-5"/> กลุ่มเจ้าหน้าที่</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-4">
            <Label className="text-muted-foreground">ค้นหา</Label>
            <Input value={q} onChange={e=>setQ(e.target.value)}
                   className="h-10 bg-background dark:bg-[#0b1220] border border-input text-foreground"/>
          </div>
          <div className="md:col-span-8"/>
        </CardContent>
      </Card>

      <Card className={card}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <span>รายการกลุ่ม</span>
            <div className="flex items-center gap-2">
              <Input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}
                     placeholder="ชื่อกลุ่มใหม่…" className="h-9 w-64 bg-background dark:bg-[#0b1220] border border-input text-foreground"/>
              <Button onClick={save} className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus className="h-4 w-4 mr-1"/> {editing?"บันทึก":"เพิ่ม"}
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border overflow-hidden">
            <Table className="bg-transparent">
              <TableHeader className={head}><TableRow>
                <TableHead className="w-[28%]">ชื่อกลุ่ม</TableHead>
                <TableHead className="w-[52%]">คำอธิบาย</TableHead>
                <TableHead className="w-[10%]">สมาชิก</TableHead>
                <TableHead className="text-right w-[10%]">Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {list.length===0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">ไม่พบกลุ่ม</TableCell></TableRow>
                ) : list.map(g=>(
                  <TableRow key={g.id} className="bg-transparent odd:dark:bg-[#0b1220]/30 hover:dark:bg-[#101826]">
                    <TableCell>{g.name}</TableCell>
                    <TableCell>{g.description || "—"}</TableCell>
                    <TableCell>{g.members}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" variant="secondary" className="bg-amber-500 text-black hover:bg-amber-600 ring-1 ring-white/10"
                              onClick={()=>openEdit(g)}><Pencil className="h-4 w-4 mr-1"/> แก้ไข</Button>
                      <Button size="sm" variant="secondary" className="bg-destructive text-destructive-foreground hover:bg-destructive/90 ring-1 ring-white/10"
                              onClick={()=>remove(g)}><Trash2 className="h-4 w-4 mr-1"/> ลบ</Button>
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

