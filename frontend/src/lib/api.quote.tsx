// FILE: src/lib/api.quote.tsx
import api from "@/lib/api.client";

/** Types */
export type Quote = {
  id: string;
  number: string;
  customer: string;
  status: string;
  created_at?: string;
};

export type QuoteHeader = {
  id: string;
  number: string;
  customer: string;
  status: string;
  notes?: string;
  created_at: string;
};

export type QuoteItem = {
  id: string;
  product_id: string;
  sku: string;
  name: string;
  qty: number;
  price_ex_vat: number;
};

export type QuoteGet = {
  header: QuoteHeader;
  items: QuoteItem[];
};

/** Create */
export async function createQuote(payload: {
  customer: string;
  notes?: string;
  team_code?: string;
  company_code?: string;
  items: { product_id: string; qty: number; price_ex_vat: number }[];
}): Promise<Quote> {
  return await api.post<Quote>("/sales/quotations", payload);
}

/** List */
export async function listQuotes(params: {
  q?: string;
  page?: number;
  per_page?: number;
  from?: string;
  to?: string;
  status?: string;
  team_code?: string;
} = {}) {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.page) qs.set("page", String(params.page));
  if (params.per_page) qs.set("per_page", String(params.per_page));
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  if (params.status) qs.set("status", params.status);
  if (params.team_code) qs.set("team_code", params.team_code);
  const q = qs.toString();
  return await api.get<any>(`/sales/quotations${q ? `?${q}` : ""}`);
}

/** Get detail (header + items) */
export async function getQuote(id: string): Promise<QuoteGet> {
  return await api.get<QuoteGet>(`/sales/quotations/${id}`);
}

/** Update status (draft | sent | accepted | rejected | expired) */
export async function setQuoteStatus(
  id: string,
  status: "draft" | "sent" | "accepted" | "rejected" | "expired"
) {
  return await api.post(`/sales/quotations/${id}/status`, { status });
}

/** Update header (use PUT — client ไม่มี patch) */
export async function patchQuoteHeader(id: string, payload: { customer?: string; notes?: string }) {
  return await api.put(`/sales/quotations/${id}`, payload);
}

/** Replace all items */
export async function replaceQuoteItems(
  id: string,
  items: { product_id: string; qty: number; price_ex_vat: number }[]
) {
  return await api.put(`/sales/quotations/${id}/items`, { items });
}

/** Add a single item */
export async function addQuoteItem(
  id: string,
  item: { product_id: string; qty: number; price_ex_vat: number }
) {
  return await api.post(`/sales/quotations/${id}/items`, item);
}

/** Delete item by row id */
export async function deleteQuoteItem(id: string, itemRowId: string) {
  return await api.delete(`/sales/quotations/${id}/items/${itemRowId}`);
}

/** Convert to SO */
export async function createSOFromQuote(
  id: string,
  payload?: { company_code?: string; team_code?: string }
) {
  // backend endpoint: /sales/quotations/{qid}/to-so
  return await api.post(`/sales/quotations/${id}/to-so`, payload ?? {});
}

/** Alias for backward-compat */
export const toSO = createSOFromQuote;

