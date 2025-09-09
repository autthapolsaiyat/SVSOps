// FILE: frontend/src/components/products/ProductSearchDialog.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { listProducts, type Product, type ProductList } from "@/lib/api.products";

type Props = { open: boolean; onOpenChange: (v: boolean) => void; teamId?: string; onPicked: (p: Product) => void; };

export default function ProductSearchDialog({ open, onOpenChange, teamId, onPicked }: Props) {
  const [q, setQ] = useState(""); const [debounced, setDebounced] = useState("");
  const [loading, setLoading] = useState(false); const [items, setItems] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null); const [activeIdx, setActiveIdx] = useState(0);
  const listRef = useRef<HTMLDivElement>(null); const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (!open) { setQ(""); setDebounced(""); setItems([]); setActiveIdx(0); setError(null);} else setTimeout(()=>inputRef.current?.focus(),0); }, [open]);
  useEffect(() => { const t=setTimeout(()=>setDebounced(q.trim()),300); return ()=>clearTimeout(t); }, [q]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true); setError(null);
      try {
        const data: ProductList = await listProducts({ q: debounced || undefined, per_page: 20, sort: "sku", order: "asc" } as any);
        setItems(Array.isArray(data.items) ? data.items : []); setActiveIdx(0);
      } catch (e:any) { setError(e?.response?.data?.detail || e?.message || "ค้นหาไม่สำเร็จ"); setItems([]); }
      finally { setLoading(false); }
    })();
  }, [debounced, open, teamId]);

  function pick(idx: number) { const item = items[idx]; if (!item) return; onPicked(item); onOpenChange(false); }
  function onKeyDown(e: React.KeyboardEvent) { if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx(i=>Math.min(i+1, Math.max(items.length-1,0))); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx(i=>Math.max(i-1,0)); }
    else if (e.key === "Enter") { e.preventDefault(); pick(activeIdx); } }

  const caption = useMemo(() => { if (loading) return "กำลังค้นหา..."; if (error) return error; if (debounced && !items.length) return `ไม่พบผลลัพธ์สำหรับ “${debounced}”`; return items.length ? `พบ ${items.length} รายการ` : "พิมพ์เพื่อค้นหา"; }, [loading, error, debounced, items]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby="product-search-desc" className="sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>เลือกสินค้า</DialogTitle>
          <DialogDescription id="product-search-desc">
            พิมพ์เพื่อค้นหา ใช้ลูกศร ↑/↓ เลื่อน และกด Enter เพื่อเลือก
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 opacity-60" />
            <Input ref={inputRef} value={q} onChange={(e)=>setQ(e.target.value)} onKeyDown={onKeyDown} placeholder="ค้นหา SKU / ชื่อสินค้า" className="pl-8" />
          </div>
          <Button variant="outline" onClick={()=>setQ("")}>ล้าง</Button>
        </div>

        <div className="text-sm opacity-70">{caption}</div>
        <div ref={listRef} className="max-h-[340px] overflow-y-auto rounded-md border divide-y" onKeyDown={onKeyDown} tabIndex={0}>
          {items.map((p,i)=>(
            <button key={p.id} data-idx={i} onClick={()=>pick(i)} className={`w-full text-left px-3 py-2 hover:bg-muted/50 ${i===activeIdx ? "bg-muted":""}`}>
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0"><div className="font-medium truncate">{p.sku}</div><div className="text-xs opacity-80 truncate">{p.name}</div></div>
                <div className="text-right shrink-0"><div className="text-xs opacity-70">{(p as any).unit}</div>
                  <div className="font-medium">{Number(p.price_ex_vat).toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2})}</div>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="text-xs opacity-60">ลูกศรขึ้น/ลงเพื่อเลือก, Enter เพื่อยืนยัน</div>
      </DialogContent>
    </Dialog>
  );
}

