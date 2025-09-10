// FILE: src/lib/stock.api.ts
import { getToken } from "@/lib/auth";

function apiBase() {
  const env = (import.meta as any).env?.VITE_API_BASE as string | undefined;
  if (env && env.trim()) return env.replace(/\/$/, "");
  return "/api"; // ผ่าน Vite proxy
}

function authHeaders() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

/* ---------- Import products (CSV/XLSX) ---------- */
export async function importProducts(
  file: File,
  mode: "upsert" | "insert" = "upsert"
) {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${apiBase()}/import?mode=${mode}`, {
    method: "POST",
    headers: { ...authHeaders() }, // FormData ไม่ต้องตั้ง Content-Type
    body: fd,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/* ---------- Inventory Ops ---------- */
export async function receiveStock(payload: {
  sku: string;
  wh: string;
  qty: number;
  unit_cost: number;
  ref?: string;
  note?: string;
}) {
  const res = await fetch(`${apiBase()}/inventory/receive`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({
      ref: payload.ref ?? "UI-RECV",
      note: payload.note ?? "from ui",
      ...payload,
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function issueStock(payload: {
  sku: string;
  wh: string;
  qty: number;
  ref?: string;
  reason?: string;
}) {
  const res = await fetch(`${apiBase()}/inventory/issue`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({
      ref: payload.ref ?? "UI-ISSUE",
      reason: payload.reason ?? "from ui",
      ...payload,
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/* ---------- Ledger hooks (บันทึกเล่มคุมอัตโนมัติหลังรับ/ตัด) ---------- */
export async function logReceiveLedger(p: {
  sku: string;
  wh: string;
  qty: number;
  unit_cost: number;
  ref?: string;
  note?: string;
}) {
  const res = await fetch(`${apiBase()}/stock/log-receive`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", ...authHeaders() },
    body: JSON.stringify(p),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function logIssueLedger(p: {
  sku: string;
  wh: string;
  qty: number;
  unit_cost?: number;
  ref?: string;
  note?: string;
}) {
  const res = await fetch(`${apiBase()}/stock/log-issue`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", ...authHeaders() },
    body: JSON.stringify(p),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/* ---------- Levels ---------- */
export type LevelRow = { sku: string; on_hand: number; reserved: number };
export async function getLevels(params: { sku: string; wh?: string }) {
  const url = new URL(`${apiBase()}/inventory/levels`, window.location.origin);
  url.searchParams.set("sku", params.sku);
  if (params.wh) url.searchParams.set("wh", params.wh);
  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json", ...authHeaders() },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<LevelRow[]>;
}

/* ---------- Stock Card ---------- */
export type StockCardRow = {
  moved_at: string;
  move_type: string;
  sku: string;
  wh?: string | null;
  qty: number;
  unit_cost?: number | null;
  ref?: string | null;
  note?: string | null;
};

export async function getStockCard(params: {
  sku: string;
  wh?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
}) {
  const url = new URL(`${apiBase()}/stock/card`, window.location.origin);
  url.searchParams.set("sku", params.sku);
  if (params.wh) url.searchParams.set("wh", params.wh);
  if (params.date_from) url.searchParams.set("date_from", params.date_from);
  if (params.date_to) url.searchParams.set("date_to", params.date_to);
  url.searchParams.set("limit", String(params.limit ?? 500));
  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json", ...authHeaders() },
  });
  if (!res.ok) throw new Error(await res.text());
  const data = (await res.json()) as { items: StockCardRow[] };
  return data.items ?? [];
}

/* ---------- Reports ---------- */
export function buildReportUrl(
  kind: "balance" | "valuation",
  args: { as_of: string; sku?: string; wh?: string }
) {
  const url = new URL(`${apiBase()}/reports/stock/${kind}`, window.location.origin);
  url.searchParams.set("as_of", args.as_of);
  if (args.sku) url.searchParams.set("sku", args.sku);
  if (args.wh) url.searchParams.set("wh", args.wh);
  return url.toString();
}

