import { useEffect, useState } from "react";
import { StockAPI, DashboardSummary } from "../lib/apiStock";

type State =
  | { loading: true; data?: undefined; error?: undefined }
  | { loading: false; data: DashboardSummary; error?: undefined }
  | { loading: false; data?: undefined; error: string };

export default function DashboardPage() {
  const [st, setSt] = useState<State>({ loading: true });

  async function load() {
    try {
      // ping backend เฉยๆ เพื่อโชว์ออนไลน์
      await StockAPI.ready();
      const data = await StockAPI.dashboardSummary();
      setSt({ loading: false, data });
    } catch (e: any) {
      setSt({ loading: false, error: e?.message || String(e) });
    }
  }

  useEffect(() => {
    load();
  }, []);

  const cards = [
    { label: "ยอดขายวันนี้", key: "sales_today" },
    { label: "ยอดขายเดือนนี้", key: "sales_month" },
    { label: "รับเข้า (วันนี้)", key: "inbound_today" },
    { label: "มูลค่าสต็อก", key: "stock_value" },
    { label: "สินค้าใกล้หมด", key: "low_stock_count" },
    { label: "PO ค้าง", key: "open_pos" },
    { label: "ใบเสนอราคา", key: "open_quotes" },
    { label: "ใบแจ้งหนี้ค้าง", key: "open_invoices" },
  ] as const;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold">ภาพรวมระบบ</h1>
        <button
          onClick={load}
          className="rounded-md border border-neutral-700 px-2 py-1 text-xs hover:bg-neutral-800"
        >
          Reload
        </button>
        {st.loading && (
          <span className="text-xs text-neutral-400">กำลังโหลด…</span>
        )}
        {st.error && (
          <span className="text-xs text-red-400">ERROR: {st.error}</span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((c) => {
          const value =
            st.data?.[c.key] != null
              ? Number(st.data[c.key as keyof DashboardSummary]).toLocaleString(
                  "th-TH"
                )
              : "-";
          return (
            <div
              key={c.key}
              className="rounded-xl border border-neutral-800 bg-white text-neutral-900 shadow
                         dark:bg-neutral-900 dark:text-neutral-100 p-4"
            >
              <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                {c.label}
              </div>
              <div className="text-3xl font-semibold">{value}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

