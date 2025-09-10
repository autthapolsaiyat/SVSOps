// FILE: src/pages/SOForm.tsx
import React, { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Check, FilePlus, Package, Plus, Save, QrCode } from "lucide-react";
import { toast } from "sonner";

// ✅ ตารางรายการสินค้า (reusable) + ตัวเลือกสินค้า + โมดัลสแกน
import ItemsTable, { ItemRow } from "@/components/product/ItemsTable";
import ProductPicker from "@/components/product/ProductPicker";
import ScanModal from "@/components/qr/ScanModal";
import { parseQr } from "@/hooks/useQr";

export default function SOForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const nav = useNavigate();

  const [customer, setCustomer] = useState("");
  const [note, setNote] = useState("");

  // รายการสินค้า
  const [items, setItems] = useState<ItemRow[]>([]);

  // เลือกสินค้า / สแกนสินค้า
  const [pickOpen, setPickOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [rowIndex, setRowIndex] = useState(0); // เก็บ index แถวที่กำลังแก้

  const card = "bg-card dark:bg-[#0f172a] border border-border dark:border-[#1f2937] shadow";
  const head = "bg-secondary dark:bg-[#0e1626] text-muted-foreground";

  // เพิ่มแถวว่าง
  function addRow() {
    setItems((prev) => [
      ...prev,
      { id: String(Date.now()), sku: "", name: "", unit: "ชิ้น", qty: 1, price: 0 },
    ]);
  }

  // เปิดสแกนแล้วเติมลงแถวใหม่ (ท้ายตาราง)
  function scanNewRow() {
    setRowIndex(items.length);
    setScanOpen(true);
  }

  // กด “เลือกสินค้า” จากแถวใน ItemsTable
  function pickForRow(i: number) {
    setRowIndex(i);
    setPickOpen(true);
  }

  // เมื่อเลือกสินค้าจาก ProductPicker แล้วเติมลงแถว
  const handlePick = useCallback((p: { sku: string; name: string; unit: string; price: number }) => {
    setItems((prev) => {
      const next = [...prev];
      if (!next[rowIndex]) {
        next[rowIndex] = { id: String(Date.now()), sku: "", name: "", unit: "ชิ้น", qty: 1, price: 0 };
      }
      next[rowIndex] = {
        ...next[rowIndex],
        sku: p.sku,
        name: p.name,
        unit: p.unit,
        price: p.price,
      };
      return next;
    });
  }, [rowIndex]);

  // เมื่อสแกนสำเร็จ
  const handleScan = useCallback((text: string) => {
    const r = parseQr(text);
    if (r.type === "product") {
      // TODO: เชื่อม API จริง: /api/products?sku=r.sku → เติมชื่อ/หน่วย/ราคา
      setItems((prev) => {
        const next = [...prev];
        if (!next[rowIndex]) {
          next[rowIndex] = { id: String(Date.now()), sku: "", name: "", unit: "ชิ้น", qty: 1, price: 0 };
        }
        next[rowIndex] = {
          ...next[rowIndex],
          sku: r.sku,
          name: r.sku,   // ชั่วคราวใช้รหัสเป็นชื่อ (เดี๋ยวเชื่อม API ค่อยเติมจริง)
          unit: "ชิ้น",
        };
        return next;
      });
    } else {
      // อย่างอื่นให้ไปหน้า resolve ชั่วคราว
      window.location.assign(`/qr/resolve?raw=${encodeURIComponent(text)}`);
    }
  }, [rowIndex]);

  function save()  { toast.success("บันทึก (UI-only)"); }
  function approve(){ toast.success("อนุมัติ (UI-only)"); }

  const total = items.reduce((s, r) => s + r.qty * r.price, 0);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      {/* Header */}
      <Card className={card}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                className="bg-muted hover:bg-muted/80"
                onClick={() => nav(-1)}
              >
                <ArrowLeft className="h-4 w-4 mr-1" /> กลับ
              </Button>
              <span className="inline-flex items-center gap-2">
                {isEdit ? <Package className="h-5 w-5" /> : <FilePlus className="h-5 w-5" />}
                {isEdit ? `แก้ไขใบสั่งขาย #${id}` : "New Sales Order"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {isEdit && (
                <Button
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={approve}
                >
                  <Check className="h-4 w-4 mr-1" /> อนุมัติ
                </Button>
              )}
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={save}>
                <Save className="h-4 w-4 mr-1" /> บันทึก
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-4">
            <Label className="text-muted-foreground">Customer</Label>
            <Input
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              className="h-10 bg-background dark:bg-[#0b1220] border border-input text-foreground"
            />
          </div>
          <div className="md:col-span-8">
            <Label className="text-muted-foreground">Note</Label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="h-10 bg-background dark:bg-[#0b1220] border border-input text-foreground"
            />
          </div>
        </CardContent>
      </Card>

      {/* Items */}
      <Card className={card}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2">
              <Package className="h-5 w-5" /> รายการสินค้า
            </span>
            <div className="flex items-center gap-2">
              <Button
                onClick={scanNewRow}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                title="สแกนสินค้า"
              >
                <QrCode className="h-4 w-4 mr-1" /> สแกนสินค้า
              </Button>
              <Button
                onClick={() => { setRowIndex(items.length); setPickOpen(true); }}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="h-4 w-4 mr-1" /> เพิ่มสินค้า
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* ✅ ใช้ตารางรายการสินค้าแบบ reuse + ปุ่มเลือกสินค้าต่อแถว */}
          <ItemsTable
            items={items}
            onChange={setItems}
            onPickProduct={(i) => { setRowIndex(i); setPickOpen(true); }}
          />

          <div className="flex justify-end mt-3 text-sm">
            <div className="px-3 py-1 rounded bg-primary/10 text-primary ring-1 ring-primary/20">
              รวมทั้งสิ้น: <b>{total.toLocaleString()}</b>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 🔽 ตัวเลือกสินค้า / สแกน QR-Barcode */}
      <ProductPicker
        open={pickOpen}
        onClose={() => setPickOpen(false)}
        onPick={(p) => handlePick(p)}
      />
      <ScanModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onResult={handleScan}
      />
    </div>
  );
}

