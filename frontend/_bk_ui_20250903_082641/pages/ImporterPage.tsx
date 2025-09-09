import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { importProducts } from "@/lib/stock.api";
import { toast } from "sonner";

export default function ImporterPage() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return toast.error("เลือกไฟล์ CSV/XLSX ก่อน");
    try {
      setBusy(true);
      const res = await importProducts(file, "upsert");
      setResult(res);
      toast.success("นำเข้าเสร็จ");
    } catch (err: any) {
      toast.error(err?.message || "นำเข้าไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6">
      <Card className="max-w-xl">
        <CardHeader><CardTitle>นำเข้าสินค้า (CSV/XLSX)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={onSubmit} className="space-y-3">
            <input type="file" accept=".csv,.xlsx" onChange={(e)=>setFile(e.target.files?.[0] ?? null)} />
            <Button type="submit" disabled={!file || busy}>{busy ? "Uploading..." : "Import"}</Button>
          </form>
          <div className="text-xs text-muted-foreground">
            Header: <code>sku,name,unit,team_code,group_code,group_name,is_domestic,group_tag</code>
          </div>
          {result && <pre className="text-sm bg-muted rounded p-3 overflow-auto">{JSON.stringify(result, null, 2)}</pre>}
        </CardContent>
      </Card>
    </div>
  );
}

