// FILE: src/pages/StockConsolePage.tsx
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { receiveStock, issueStock, logReceiveLedger, logIssueLedger } from "@/lib/stock.api";
import { toast } from "sonner";
import { Link } from "react-router-dom";

export default function StockConsolePage() {
  const [sku, setSku] = useState("");
  const [wh, setWh] = useState("MAIN");
  const [qty, setQty] = useState<number>(1);
  const [cost, setCost] = useState<number>(0);

  const [busyR, setBusyR] = useState(false);
  const [busyI, setBusyI] = useState(false);

  const canReceive = !!sku && !!wh && qty > 0 && cost >= 0 && !busyR;
  const canIssue = !!sku && !!wh && qty > 0 && !busyI;

  async function doReceive() {
    if (!canReceive) return;
    setBusyR(true);
    try {
      // 1) ทำรายการสต๊อก
      await receiveStock({ sku, wh, qty, unit_cost: cost, ref: "UI-RECV" });

      // 2) บันทึกเล่มคุม (ถ้า endpoint ฝั่ง backend เปิดอยู่)
      try {
        await logReceiveLedger({ sku, wh, qty, unit_cost: cost, ref: "UI-RECV", note: "ui-receive" });
      } catch (e: any) {
        // ไม่ให้ล้ม flow หลัก — แจ้งเตือนเฉย ๆ
        toast.message("รับเข้าแล้ว แต่บันทึกเล่มคุมไม่สำเร็จ", { description: String(e?.message || e).slice(0, 160) });
      }

      toast.success(`รับเข้า ${sku} +${qty}`);
      // สะดวกใช้งานต่อ: keep SKU/WH แล้วรีเซ็ตจำนวน
      setQty(1);
    } catch (e: any) {
      toast.error(e?.message ?? "รับเข้าไม่สำเร็จ");
    } finally {
      setBusyR(false);
    }
  }

  async function doIssue() {
    if (!canIssue) return;
    setBusyI(true);
    try {
      // 1) ทำรายการสต๊อก
      await issueStock({ sku, wh, qty, ref: "UI-ISSUE" });

      // 2) บันทึกเล่มคุม (unit_cost ถ้าไม่ระบุ backend จะ fallback เป็นต้นทุน IN ล่าสุดของคลังนั้น)
      try {
        await logIssueLedger({ sku, wh, qty, ref: "UI-ISSUE", note: "ui-issue" });
      } catch (e: any) {
        toast.message("ตัดออกแล้ว แต่บันทึกเล่มคุมไม่สำเร็จ", { description: String(e?.message || e).slice(0, 160) });
      }

      toast.success(`ตัดออก ${sku} -${qty}`);
      setQty(1);
    } catch (e: any) {
      toast.error(e?.message ?? "ตัดออกไม่สำเร็จ");
    } finally {
      setBusyI(false);
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>, action: "recv" | "issue") {
    if (e.key === "Enter") {
      e.preventDefault();
      action === "recv" ? doReceive() : doIssue();
    }
  }

  return (
    <div className="p-6 grid gap-6 md:grid-cols-2">
      <section className="app-section">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Receive (รับเข้า)</h2>
          {/* ลิงก์ไปดูเล่มคุมของ SKU ที่กำลังทำงาน */}
          {sku && <Link className="underline text-sm" to={`/card?sku=${encodeURIComponent(sku)}&wh=${encodeURIComponent(wh)}`}>ดูเล่มคุม</Link>}
        </div>
        <div className="grid gap-2">
          <Input placeholder="SKU" value={sku} onChange={(e)=>setSku(e.target.value)} onKeyDown={(e)=>onKey(e,"recv")} />
          <Input placeholder="WH (เช่น MAIN)" value={wh} onChange={(e)=>setWh(e.target.value)} onKeyDown={(e)=>onKey(e,"recv")} />
          <Input type="number" placeholder="QTY" value={qty} onChange={(e)=>setQty(+e.target.value)} onKeyDown={(e)=>onKey(e,"recv")} />
          <Input type="number" placeholder="Unit Cost" value={cost} onChange={(e)=>setCost(+e.target.value)} onKeyDown={(e)=>onKey(e,"recv")} />
          <div className="pt-2">
            <Button onClick={doReceive} disabled={!canReceive}>
              {busyR ? "Receiving..." : "Receive"}
            </Button>
          </div>
        </div>
      </section>

      <section className="app-section">
        <h2 className="text-lg font-semibold mb-3">Issue (ตัดออก)</h2>
        <div className="grid gap-2">
          <Input placeholder="SKU" value={sku} onChange={(e)=>setSku(e.target.value)} onKeyDown={(e)=>onKey(e,"issue")} />
          <Input placeholder="WH (เช่น MAIN)" value={wh} onChange={(e)=>setWh(e.target.value)} onKeyDown={(e)=>onKey(e,"issue")} />
          <Input type="number" placeholder="QTY" value={qty} onChange={(e)=>setQty(+e.target.value)} onKeyDown={(e)=>onKey(e,"issue")} />
          <div className="pt-2">
            <Button variant="destructive" onClick={doIssue} disabled={!canIssue}>
              {busyI ? "Issuing..." : "Issue"}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

