// FILE: src/components/quotes/CatalogPicker.tsx
import { useEffect, useState } from "react";
import { searchQuoteCatalog, type QuoteCatalogItem } from "@/lib/api.quoteCatalog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function CatalogPicker({
  token,
  open,
  onClose,
  onPick,
}: {
  token: string;
  open: boolean;
  onClose: () => void;
  onPick: (it: QuoteCatalogItem) => void;
}) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<QuoteCatalogItem[]>([]);

  const doSearch = async () => {
    try {
      setLoading(true);
      const res = await searchQuoteCatalog(q.trim(), token, 1, 20);
      setItems(res.items || []);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setQ("");
      setItems([]);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 grid place-items-center">
      <div className="w-[min(960px,95vw)] rounded-2xl bg-background p-4 shadow-lg border border-border">
        <div className="flex items-center gap-2">
          <Input placeholder="ค้นหา (part no./description/CAS/SKU)" value={q} onChange={(e)=>setQ(e.target.value)} />
          <Button onClick={doSearch} disabled={loading}>ค้นหา</Button>
          <div className="flex-1" />
          <Button variant="ghost" onClick={onClose}>ปิด</Button>
        </div>
        <div className="mt-3 max-h-[60vh] overflow-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30">
              <tr className="text-left">
                <th className="p-2">Part No.</th>
                <th className="p-2">Descriptions</th>
                <th className="p-2">CAS</th>
                <th className="p-2">Package</th>
                <th className="p-2 text-right">Default Price</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it)=>(
                <tr key={it.id} className="border-b">
                  <td className="p-2 font-mono">{it.part_no}</td>
                  <td className="p-2">{it.description}</td>
                  <td className="p-2">{it.cas_no ?? "-"}</td>
                  <td className="p-2">{it.package_label ?? "-"}</td>
                  <td className="p-2 text-right">{it.default_price_ex_vat?.toLocaleString() ?? "-"}</td>
                  <td className="p-2 text-right">
                    <Button size="sm" onClick={()=>{ onPick(it); onClose(); }}>เลือก</Button>
                  </td>
                </tr>
              ))}
              {!items.length && (
                <tr><td className="p-4 text-center text-muted-foreground" colSpan={6}>
                  {loading ? "กำลังค้นหา..." : "ยังไม่มีผลลัพธ์"}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

