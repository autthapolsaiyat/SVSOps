import { useEffect, useState } from "react";
import { StockAPI, type GoodsReceipt, type Paginated } from "../lib/apiStock";

export default function GoodsReceiptsPage() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [data, setData] = useState<Paginated<GoodsReceipt> | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function load() {
    setLoading(true); setErr("");
    try {
      const res = await StockAPI.listGoodsReceipts(page, pageSize);
      setData(res);
    } catch (e:any) { setErr(String(e?.message || e)); }
    finally { setLoading(false); }
  }

  useEffect(()=>{ load(); /* eslint-disable-next-line */}, [page]);

  const total = data?.total ?? 0;
  const items = data?.items ?? [];

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xl font-semibold">ใบรับสินค้า (GR)</div>
        <button className="border rounded px-3 py-1" onClick={load} disabled={loading}>
          {loading ? "กำลังโหลด..." : "Reload"}
        </button>
      </div>

      {err && <div className="text-sm text-red-500">{err}</div>}

      <div className="rounded-xl border overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/30">
            <tr>
              <th className="px-3 py-2 text-left">ID</th>
              <th className="px-3 py-2 text-left">เลขที่</th>
              <th className="px-3 py-2 text-left">วันที่</th>
              <th className="px-3 py-2 text-left">ผู้ขาย</th>
              <th className="px-3 py-2 text-left">สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td className="px-3 py-3 text-muted-foreground" colSpan={5}>ไม่มีข้อมูล</td></tr>
            ) : items.map((it:any, idx:number) => (
              <tr key={idx} className="border-t">
                <td className="px-3 py-2">{it.id}</td>
                <td className="px-3 py-2">{it.gr_no ?? "-"}</td>
                <td className="px-3 py-2">{it.gr_date}</td>
                <td className="px-3 py-2">{it.supplier?.name}</td>
                <td className="px-3 py-2">{it.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center pt-2 text-sm text-muted-foreground">
        <div>รวม {total.toLocaleString()} รายการ</div>
        <div className="flex gap-2">
          <button className="border rounded px-3 py-1" onClick={()=>setPage(p=>Math.max(1,p-1))}>ก่อนหน้า</button>
          <div className="px-2">หน้า {page}</div>
          <button className="border rounded px-3 py-1" onClick={()=>setPage(p=>p+1)}>ถัดไป</button>
        </div>
      </div>

      <div className="pt-4">
        <GRPostWidget />
      </div>
    </div>
  );
}

function GRPostWidget() {
  const [grid, setGrid] = useState("GR-TEST");
  const [msg, setMsg] = useState("");

  async function post() {
    setMsg("");
    try {
      const r = await fetch(`/api/inventory/receipts/${encodeURIComponent(grid)}/post`, {
        method: "POST",
        headers: { Accept: "application/json", Authorization: `Bearer ${localStorage.getItem("token")||""}` },
      });
      const body = await r.text();
      if (!r.ok) throw new Error(`${r.status}: ${body}`);
      setMsg(`OK: ${body}`);
    } catch (e:any) { setMsg(`Error: ${e.message || e}`); }
  }

  return (
    <div className="flex gap-2 items-center">
      <div className="font-medium">Actions:</div>
      <input value={grid} onChange={e=>setGrid(e.target.value)} className="border rounded px-3 py-1" />
      <button onClick={post} className="border rounded px-3 py-1">Post GR</button>
      {msg && <span className="text-xs">{msg}</span>}
    </div>
  );
}

