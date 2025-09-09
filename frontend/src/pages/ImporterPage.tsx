import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { importProducts } from "@/lib/stock.api";
import { toast } from "sonner";

export default function ImporterPage() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return toast.error("เลือกไฟล์ CSV/XLSX ก่อน");
    try {
      setBusy(true);
      const res = await importProducts(file, "upsert");
      setResult(res);
      toast.success("นำเข้าสำเร็จ");
    } catch (e: any) {
      toast.error(e?.message ?? "นำเข้าไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-6">
      <section className="app-section max-w-xl">
        <h2 className="text-lg font-semibold mb-3">นำเข้าสินค้า (CSV/XLSX)</h2>
        <form onSubmit={onSubmit} className="space-y-3">
          <input type="file" accept=".csv,.xlsx" onChange={(e)=>setFile(e.target.files?.[0] ?? null)} />
          <div>
            <Button type="submit" disabled={!file || busy}>
              {busy ? "Uploading..." : "Import"}
            </Button>
          </div>
        </form>
        <div className="mt-3 text-xs opacity-70">
          Header: <code>sku,name,unit,team_code,group_code,group_name,is_domestic,group_tag</code>
        </div>
        {result && (
          <pre className="mt-3 text-sm bg-card rounded-md border border-border p-3 overflow-auto">
{JSON.stringify(result, null, 2)}
          </pre>
        )}
      </section>
    </div>
  );
}

