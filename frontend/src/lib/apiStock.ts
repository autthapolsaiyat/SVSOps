// src/lib/apiStock.ts

// ---------- Types (เดิม) ----------
export type PartnerRef = { id?: string; code?: string; name: string };
export type ProductRef = { id?: string; sku: string; name: string; uom?: string };

export type QuotationLine = {
  id?: string; product: ProductRef; qty: number; price: number; discount?: number; amount?: number
};
export type Quotation = {
  id: string; quo_no?: string | null; quo_date: string; customer: PartnerRef;
  status: "DRAFT" | "SENT" | "APPROVED" | "REJECTED";
  subtotal?: number | null; vat?: number | null; total?: number | null;
  lines?: QuotationLine[];
};

export type PurchaseOrderLine = { id?: string; product: ProductRef; qty: number; price: number; amount?: number };
export type PurchaseOrder = {
  id: string; po_no?: string | null; po_date: string; supplier: PartnerRef;
  status: "DRAFT" | "SUBMITTED" | "PARTIAL" | "RECEIVED" | "CLOSED";
  total?: number | null; lines?: PurchaseOrderLine[];
};

export type GoodsReceiptLine = { product: ProductRef; qty: number; lot?: string | null; expiry?: string | null };
export type GoodsReceipt = {
  id: string; gr_no?: string | null; gr_date: string; ref_po?: string | null; supplier: PartnerRef;
  status: "DRAFT" | "POSTED"; lines?: GoodsReceiptLine[];
};

export type SalesOrderLine = { product: ProductRef; qty: number; price: number; amount?: number };
export type SalesOrder = {
  id: string; so_no?: string | null; so_date: string; customer: PartnerRef;
  status: "DRAFT" | "CONFIRMED" | "DELIVERED" | "INVOICED";
  total?: number | null; lines?: SalesOrderLine[];
};

export type Invoice = {
  id: string; inv_no?: string | null; inv_date: string; customer: PartnerRef;
  status: "UNPAID" | "PARTIAL" | "PAID"; so_ref?: string | null; total?: number | null;
};

export type Paginated<T> = { items: T[]; total: number; page: number; page_size: number };

export type DashboardSummary = {
  sales_today: number; sales_month: number; inbound_today: number;
  stock_value: number; low_stock_count: number; open_pos: number;
  open_quotes: number; open_invoices: number;
};

// ---------- Env ----------
const DEFAULT_TEAM_ID =
  (import.meta as any).env?.VITE_DEFAULT_TEAM_ID ||
  "e29e7da3-ecae-4184-a1dd-82320c918692";

// ---------- helpers ----------
const ensureApiPath = (p: string) => {
  if (/^https?:\/\//i.test(p)) return p;
  if (p.startsWith("/api")) return p;
  if (p.startsWith("api/")) return "/" + p;
  return p.startsWith("/") ? `/api${p}` : `/api/${p}`;
};

async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem("token") || "";
  const teamId = localStorage.getItem("team_id") || DEFAULT_TEAM_ID;
  const url = ensureApiPath(path);

  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(teamId ? { "X-Team-Id": teamId } : {}),
      ...(init?.headers || {}),
    },
    credentials: "include",
  });

  const raw = await res.text();
  const ct = res.headers.get("content-type") || "";

  if (!res.ok) {
    try {
      const j = raw ? JSON.parse(raw) : (null as any);
      const msg = j?.detail || j?.message || JSON.stringify(j);
      throw new Error(`HTTP ${res.status}: ${msg || res.statusText}`);
    } catch {
      throw new Error(`HTTP ${res.status}: ${raw || res.statusText}`);
    }
  }

  if (ct.includes("application/json")) return JSON.parse(raw) as T;
  if (/^[\s\r\n]*[{\[]/.test(raw)) {
    return JSON.parse(raw) as T;
  }
  return undefined as unknown as T;
}

// convenience wrappers
async function apiGet<T>(path: string, init?: RequestInit) {
  return getJson<T>(path, { ...init, method: "GET" });
}
async function apiPost<T>(path: string, body: unknown, init?: RequestInit) {
  return getJson<T>(path, {
    method: "POST",
    body: JSON.stringify(body ?? {}),
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
}

// ---------- StockAPI (เดิม) ----------
export const StockAPI = {
  ready() {
    return fetch("/api/ready", { credentials: "include" })
      .then((r) => r.ok)
      .catch(() => false);
  },

  dashboardSummary() {
    return getJson<DashboardSummary>("/api/dashboard/summary");
  },
  dashboard() {
    return getJson<DashboardSummary>("/api/dashboard/summary");
  },

  listQuotes(page = 1, pageSize = 10) {
    return getJson<Paginated<Quotation>>(`/api/quotes?page=${page}&page_size=${pageSize}`);
  },
  listPurchaseOrders(page = 1, pageSize = 10) {
    return getJson<Paginated<PurchaseOrder>>(`/api/purchase-orders?page=${page}&page_size=${pageSize}`);
  },
  listGoodsReceipts(page = 1, pageSize = 10) {
    return getJson<Paginated<GoodsReceipt>>(`/api/inventory/receipts?page=${page}&page_size=${pageSize}`);
  },
  listSalesOrders(page = 1, pageSize = 10) {
    return getJson<Paginated<SalesOrder>>(`/api/sales/orders?page=${page}&page_size=${pageSize}`);
  },
  listInvoices(page = 1, pageSize = 10) {
    return getJson<Paginated<Invoice>>(`/api/billing/invoices?page=${page}&page_size=${pageSize}`);
  },
};

// ---------- Master types ----------
export type Team = { id: string; name: string; code?: string };
export type ProductGroup = { id: string; name: string; code?: string };

// ---------- Masters ----------
export async function listTeams(): Promise<Team[]> {
  // backend: { items: [{ code, label } ...] }
  const r = await apiGet<{ items: { code: string; label?: string; name?: string }[] }>(
    "/api/products/teams"
  );
  return (r.items || []).map((it) => ({
    id: it.code,
    name: it.label ?? it.name ?? it.code,
    code: it.code,
  }));
}

export async function listProductGroups(): Promise<ProductGroup[]> {
  // backend: { items: [{ code, name } ...] }  (บางที่ใช้ label)
  const r = await apiGet<{ items: { code: string; name?: string; label?: string }[] }>(
    "/api/products/groups"
  );
  return (r.items || []).map((it) => ({
    id: it.code,
    name: it.name ?? it.label ?? it.code,
    code: it.code,
  }));
}

// ---------- Products ----------
export type ProductRow = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  team_id?: string | null;
};
export type ProductListResp = {
  items: ProductRow[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
};

/** ดึงรายการสินค้า (พยายาม /products/list ก่อน ถ้า 404 ค่อย fallback ไป /products) */
export async function listProducts(params: {
  q?: string;
  page?: number;
  per_page?: number;
  team_id?: string;
  sort?: "sku" | "name" | "unit" | "price_ex_vat";
  order?: "asc" | "desc";
}) {
  const qs = new URLSearchParams();
  if (params?.q) qs.set("q", params.q);
  qs.set("page", String(params?.page ?? 1));
  qs.set("per_page", String(params?.per_page ?? 10));
  if (params?.team_id) qs.set("team_id", params.team_id);
  if (params?.sort) qs.set("sort", params.sort);
  if (params?.order) qs.set("order", params.order);

  const try1 = async () =>
    apiGet<ProductListResp>(`/api/products/list?${qs.toString()}`);

  const try2 = async () =>
    apiGet<ProductListResp>(`/api/products?${qs.toString()}`);

  try {
    return await try1();
  } catch (e: any) {
    if (typeof e?.message === "string" && e.message.startsWith("HTTP 404")) {
      return await try2();
    }
    throw e;
  }
}

/** อ่านสินค้าด้วย SKU (compat) */
export async function getProductByCode(code: string, team_id?: string) {
  const q = new URLSearchParams({ sku: code });
  if (team_id) q.set("team_id", team_id);
  return apiGet<{
    id: string;
    sku: string;
    name: string;
    unit?: string;
    price_ex_vat?: string | number | null;
    team_id?: string | null;
  }>(`/api/products/get?${q.toString()}`);
}
export const getProductBySku = getProductByCode;

/** upsert (insert/update) */
export type UpsertProductInput = {
  code: string; // == sku
  name: string;
  unit: string;
  barcode?: string | null;
  team_id?: string | null;
  group_id?: string | null;
  price?: number | null; // map → price_ex_vat
  cost?: number | null;
  reorder_level?: number | null;
  is_active?: boolean;
  description?: string | null;
};
export type ProductUpsertResponse = {
  id: string;
  code: string; // sku
  name: string;
  unit?: string;
  price_ex_vat?: string | number | null;
  team_id?: string | null;
};

export async function upsertProduct(input: UpsertProductInput): Promise<ProductUpsertResponse> {
  const payload: Record<string, unknown> = {
    sku: input.code,
    name: input.name,
    unit: input.unit,
    price_ex_vat: input.price ?? 0,
  };
  if (input.team_id) payload["team_id"] = input.team_id;

  const res = await apiPost<{
    id: string; sku: string; name: string; unit?: string;
    price_ex_vat?: string | number | null; team_id?: string | null;
  }>("/api/products/upsert", payload);

  return {
    id: res.id,
    code: res.sku,
    name: res.name,
    unit: res.unit,
    price_ex_vat: res.price_ex_vat ?? null,
    team_id: (res as any).team_id ?? null,
  };
}

