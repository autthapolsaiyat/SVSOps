// FILE: src/pages/ProductEntryPage.tsx
import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { importProducts } from "@/lib/stock.api";
import { toast } from "sonner";

type FormState = {
  sku: string;
  name: string;
  unit: string;
  team_code: string;       // เช่น STD
  group_code: string;      // เช่น ORG-LOCAL (ว่างได้)
  group_name: string;      // เช่น กลุ่มสินค้าในประเทศ (ว่างได้)
  is_domestic: boolean;    // true/false
  group_tag: string;       // ว่างได้
};

const defaults: FormState = {
  sku: "",
  name: "",
  unit: "EA",
  team_code: "STD",
  group_code: "",
  group_name: "",
  is_domestic: true,
  group_tag: "",
};

export default function ProductEntryPage() {
  const [f, setF] = useState<FormState>(defaults);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);

  function set<K extends keyof FormState>(key: K, v: FormState[K]) {
    setF((s) => ({ ...s, [key]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.sku.trim() || !f.name.trim()) {
      return toast.error("กรอก SKU และชื่อสินค้า");
    }
    try {
      setBusy(true);

      // สร้าง CSV 1 แถวด้วย header ตามระบบ
      // sku,name,unit,team_code,group_code,group_name,is_domestic,group_tag
      const header = "sku,name,unit,team_code,group_code,group_name,is_domestic,group_tag\n";
      const row = [
        f.sku.trim(),
        f.name.trim(),
        f.unit.trim(),
        f.team_code.trim(),
        f.group_code.trim(),
        f.group_name.trim(),
        String(!!f.is_domestic),
        f.group_tag.trim(),
      ].map(csvEscape).join(",") + "\n";

      const csv = header + row;
      const file = new File([csv], `product_${f.sku.trim()}.csv`, { type: "text/csv" });

      const res = await importProducts(file, "upsert");
      setResult(res);
      toast.success("บันทึกสินค้าเรียบร้อย");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  function csvEscape(v: string) {
    const needs = /[",\n]/.test(v);
    return needs ? `"${v.replace(/"/g, '""')}"` : v;
  }

  function resetForm() {
    setF(defaults);
    setResult(null);
  }

  return (
    <div className="p-6">
      <section className="app-section max-w-2xl">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">ป้อนสินค้าใหม่</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={resetForm}>ล้างฟอร์ม</Button>
          </div>
        </div>

        <form onSubmit={onSubmit} className="grid gap-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm opacity-80">SKU *</label>
              <Input value={f.sku} onChange={(e)=>set("sku", e.target.value)} placeholder="TEST-001" />
            </div>
            <div>
              <label className="text-sm opacity-80">หน่วย (unit)</label>
              <Input value={f.unit} onChange={(e)=>set("unit", e.target.value)} placeholder="EA / ชิ้น / Bott" />
            </div>
          </div>

          <div>
            <label className="text-sm opacity-80">ชื่อสินค้า *</label>
            <Input value={f.name} onChange={(e)=>set("name", e.target.value)} placeholder="ชื่อสินค้า" />
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm opacity-80">ทีม (team_code)</label>
              <Input value={f.team_code} onChange={(e)=>set("team_code", e.target.value)} placeholder="STD" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm opacity-80">กลุ่ม (group_code)</label>
                <Input value={f.group_code} onChange={(e)=>set("group_code", e.target.value)} placeholder="ORG-LOCAL" />
              </div>
              <div>
                <label className="text-sm opacity-80">ชื่อกลุ่ม (group_name)</label>
                <Input value={f.group_name} onChange={(e)=>set("group_name", e.target.value)} placeholder="กลุ่มสินค้าในประเทศ" />
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-[160px_1fr] gap-3">
            <div className="flex items-center gap-2">
              <input id="isdom" type="checkbox" checked={f.is_domestic} onChange={(e)=>set("is_domestic", e.target.checked)} />
              <label htmlFor="isdom" className="text-sm opacity-80 select-none">ในประเทศ (is_domestic)</label>
            </div>
            <div>
              <label className="text-sm opacity-80">แท็กกลุ่ม (group_tag)</label>
              <Input value={f.group_tag} onChange={(e)=>set("group_tag", e.target.value)} placeholder="เช่น เคมี-เกรดวิเคราะห์" />
            </div>
          </div>

          <div className="pt-2">
            <Button type="submit" disabled={busy || !f.sku.trim() || !f.name.trim()}>
              {busy ? "Saving..." : "บันทึกสินค้า"}
            </Button>
          </div>
        </form>

        {result && (
          <pre className="mt-4 text-sm bg-card rounded-md border border-border p-3 overflow-auto">
{JSON.stringify(result, null, 2)}
          </pre>
        )}

        <div className="mt-3 text-xs opacity-70">
          ตัวอย่าง header: <code>sku,name,unit,team_code,group_code,group_name,is_domestic,group_tag</code>
        </div>
      </section>
    </div>
  );
}

