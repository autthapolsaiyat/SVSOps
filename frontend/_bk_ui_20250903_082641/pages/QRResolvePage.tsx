// FILE: src/pages/QRResolvePage.tsx
import React, { useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { parseQr } from "@/hooks/useQr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function QRResolvePage() {
  const nav = useNavigate();
  const loc = useLocation();
  const raw = useMemo(() => new URLSearchParams(loc.search).get("raw") || "", [loc.search]);
  const res = useMemo(() => parseQr(raw), [raw]);

  useEffect(() => {
    // Auto navigate กรณีรู้ปลายทางชัดเจน
    if (res.type === "product") {
      nav(`/products?q=${encodeURIComponent(res.sku)}`, { replace: true });
    } else if (res.type === "so") {
      // ยังไม่มี detail → ไปที่ list พร้อมค้นหา
      nav(`/sales-orders?q=${encodeURIComponent(res.no)}`, { replace: true });
    }
  }, [res, nav]);

  if (res.type === "product" || res.type === "so") return null; // กำลัง redirect

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Card className="bg-card dark:bg-[#0f172a] border border-border dark:border-[#1f2937]">
        <CardHeader><CardTitle>ผลจาก QR / Barcode</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-muted-foreground">ค่าที่ได้:</div>
          <pre className="text-xs bg-background dark:bg-[#0b1220] border border-input rounded p-3 overflow-auto">
            {raw || "(ว่าง)"}
          </pre>
          {res.type === "url" && (
            <Button className="bg-primary text-primary-foreground" onClick={()=>window.location.assign(res.url)}>
              เปิดลิงก์
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

