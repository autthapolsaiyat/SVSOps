// FILE: src/lib/api.dashboard.ts
import api from "./api.client";

/** ===== Summary ===== */
export type SummaryTopItem = {
  sku: string;
  name: string;
  unit: string;
  // backend อาจคืน "1234.00" เป็น string
  price_ex_vat: number | string;
};

export type Summary = {
  total_products: number;
  total_value_ex_vat: number;
  new_products_last_days: { days: number; count: number };
  top5_by_price: SummaryTopItem[];

  // ฟิลด์ใหม่จาก backend
  quotes_this_month: number;
  pos_this_month: number;
  sos_this_month: number;
  last_quote_number?: string | null;
  period_yyyymm: string;
};

export async function getSummary(days = 7): Promise<Summary> {
  // api.get() ของโปรเจกต์คืน JSON ตรง ๆ
  return await api.get<Summary>(`/dashboard/summary?days=${days}`);
}

/** ===== Stock summary (backend) ===== */
export type StockSummary = {
  total_on_hand: number;
  total_reserved: number;
  total_available: number;
  top_by_on_hand: { sku: string; name: string; on_hand: number }[];
  out_of_stock: { sku: string; name: string; available: number }[];
  source: string;      // "stock_levels" | "unavailable"
  detail?: string;
};

export async function getStockSummary(): Promise<StockSummary> {
  return await api.get<StockSummary>("/dashboard/stock");
}

/** ===== Timeseries (docs per day) ===== */
export type DocSeriesPoint = { date: string; quotes: number; pos: number; sos: number };

export async function getDocSeries(days = 30): Promise<DocSeriesPoint[]> {
  return await api.get<DocSeriesPoint[]>(`/dashboard/timeseries?days=${days}`);
}

