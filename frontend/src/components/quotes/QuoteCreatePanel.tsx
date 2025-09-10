// FILE: src/components/quotes/QuoteCreatePanel.tsx
import React, { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import type { Product } from "@/lib/api.products";

type Row = {
  id: string;
  part_no: string;
  description: string;
  cas_no?: string;
  package_label?: string; // เก็บ "หน่วย"
  warn_text?: string;
  qty: number;
  price_ex_vat: number;
  amount: number;
};

type Props = {
  token: string;
  teams: string[];
  defaultCompany?: string;
  onCreate: (payload: {
    customer: string;
    company_code?: string;
    team_code?: string;
    items: Array<{
      catalog_id?: string;
      part_no?: string;
      description?: string;
      cas_no?: string;
      package_label?: string;
      warn_text?: string;
      qty: number;
      price_ex_vat: number;
    }>;
  }) => Promise<void> | void;
};

function newRow(): Row {
  return {
    id: crypto.randomUUID(),
    part_no: "",
    description: "",
    cas_no: "",
    package_label: "",
    warn_text: "",
    qty: 1,
    price_ex_vat: 0,
    amount: 0,
  };
}

export function QuoteCreatePanel({ teams, defaultCompany = "SVS", onCreate }: Props) {
  const [customer, setCustomer] = useState<string>("");
  const [company, setCompany] = useState<string>(defaultCompany);
  const [team, setTeam] = useState<string>(teams[0] ?? "");
  const [rows, setRows] = useState<Row[]>([newRow()]);

  const total = useMemo(
    () => rows.reduce((s, r) => s + (Number.isFinite(r.amount) ? r.amount : 0), 0),
    [rows]
  );

  function setRow(idx: number, patch: Partial<Row>) {
    setRows((prev) => {
      const next = [...prev];
      const cur = { ...next[idx], ...patch };
      const qty = Math.max(0, Number(cur.qty) || 0);
      const price = Math.max(0, Number(cur.price_ex_vat) || 0);
      cur.amount = +(qty * price).toFixed(2);
      next[idx] = cur;
      return next;
    });
  }

  function addRow() {
    setRows((prev) => [...prev, newRow()]);
  }
  function removeRow(idx: number) {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
  }

  async function pickProduct(idx: number) {
    if (!("svsProductPicker" in window) || !window.svsProductPicker?.open) {
      toast.error("ไม่พบตัวเลือกสินค้า (Product Picker)");
      return;
    }
    try {
      const p: Product = await window.svsProductPicker.open({ teamId: undefined });
      setRow(idx, {
        part_no: p.sku,
        description: p.name,
        price_ex_vat: Number(p.price_ex_vat) || 0,
        package_label: (p as any).unit ?? "",      // หน่วย
        cas_no: (p as any).cas_no ?? "",            // ⬅️ เติม CAS No. ถ้ามีใน product
      });
    } catch {
      /* user cancelled */
    }
  }

  async function handleCreate() {
    if (!customer.trim()) return toast.error("กรุณากรอกชื่อลูกค้า");
    const items = rows
      .filter((r) => (r.part_no || r.description) && r.qty > 0)
      .map((r) => ({
        part_no: r.part_no?.trim() || undefined,
        description: r.description?.trim() || undefined,
        cas_no: r.cas_no?.trim() || undefined,
        package_label: r.package_label?.trim() || undefined,
        warn_text: r.warn_text?.trim() || undefined,
        qty: Number(r.qty) || 0,
        price_ex_vat: Number(r.price_ex_vat) || 0,
      }));
    if (!items.length) return toast.error("กรุณาเพิ่มรายการอย่างน้อย 1 รายการ");

    try {
      await onCreate({
        customer: customer.trim(),
        company_code: company || undefined,
        team_code: team || undefined,
        items,
      });
      setRows([newRow()]);
      setCustomer("");
      toast.success("สร้างใบเสนอราคาแล้ว");
    } catch (e: any) {
      toast.error(e?.message ?? "สร้างใบเสนอราคาไม่สำเร็จ");
    }
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card/10 p-4 space-y-4">
      <h2 className="text-lg font-semibold">สร้างใบเสนอราคา</h2>

      {/* Header */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="col-span-2">
          <div className="text-sm opacity-70 mb-1">ลูกค้า</div>
          <Input placeholder="ชื่อลูกค้า" value={customer} onChange={(e) => setCustomer(e.target.value)} />
        </div>
        <div>
          <div className="text-sm opacity-70 mb-1">บริษัท</div>
          <Input placeholder="บริษัท" value={company} onChange={(e) => setCompany(e.target.value)} />
        </div>
        <div>
          <div className="text-sm opacity-70 mb-1">ทีม</div>
          <select
            className="border rounded-md px-2 py-2 text-sm w-full bg-transparent"
            value={team}
            onChange={(e) => setTeam(e.target.value)}
          >
            {teams.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Items header */}
      <div className="grid grid-cols-12 gap-2 text-xs opacity-70">
        <div className="col-span-1">เลือก</div>
        <div className="col-span-2">Part No.</div>
        <div className="col-span-3">Descriptions</div>
        <div className="col-span-2">CAS No.</div>
        <div className="col-span-1">Unit / Package</div>
        <div className="col-span-1">Warn</div>
        <div className="col-span-1 text-right">Qty</div>
        <div className="col-span-1 text-right">Unit Price</div>
      </div>

      {/* Items rows */}
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={r.id} className="grid grid-cols-12 gap-2 items-center">
            <div className="col-span-1">
              <Button size="sm" variant="outline" onClick={() => pickProduct(i)}>เลือก</Button>
            </div>
            <div className="col-span-2">
              <Input placeholder="Part No." value={r.part_no} onChange={(e) => setRow(i, { part_no: e.target.value })} />
            </div>
            <div className="col-span-3">
              <Input placeholder="Descriptions" value={r.description} onChange={(e) => setRow(i, { description: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Input placeholder="CAS No." value={r.cas_no} onChange={(e) => setRow(i, { cas_no: e.target.value })} />
            </div>
            <div className="col-span-1">
              <Input placeholder="Unit / Package" value={r.package_label} onChange={(e) => setRow(i, { package_label: e.target.value })} />
            </div>
            <div className="col-span-1">
              <Input placeholder="Warn" value={r.warn_text} onChange={(e) => setRow(i, { warn_text: e.target.value })} />
            </div>
            <div className="col-span-1">
              <Input type="number" inputMode="decimal" step="1" value={r.qty} onChange={(e) => setRow(i, { qty: Number(e.target.value) })} className="text-right" />
            </div>
            <div className="col-span-1">
              <Input type="number" inputMode="decimal" step="0.01" value={r.price_ex_vat} onChange={(e) => setRow(i, { price_ex_vat: Number(e.target.value) })} className="text-right" />
            </div>

            <div className="col-span-12 flex justify-between items-center">
              <div className="text-sm opacity-70">
                จำนวนเงิน: {r.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <Button size="icon" variant="ghost" onClick={() => removeRow(i)} disabled={rows.length <= 1} aria-label="ลบรายการ">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* footer actions */}
      <div className="flex items-center justify-between">
        <div className="text-sm">
          รวมทั้งสิ้น: <span className="font-semibold">{total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
        <div className="space-x-2">
          <Button variant="outline" onClick={addRow}><Plus className="w-4 h-4 mr-1" />เพิ่มรายการ</Button>
          <Button onClick={handleCreate}>สร้าง</Button>
        </div>
      </div>
    </div>
  );
}

export default QuoteCreatePanel;

