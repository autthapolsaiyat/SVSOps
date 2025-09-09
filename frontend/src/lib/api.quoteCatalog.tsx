// FILE: src/lib/api.quoteCatalog.ts
export async function api<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export type QuoteCatalogItem = {
  id: string;
  sku?: string | null;
  part_no: string;
  description: string;
  cas_no?: string | null;
  package_label?: string | null;
  warn_text?: string | null;
  default_price_ex_vat?: number | null;
};

export async function searchQuoteCatalog(q: string, token: string, page = 1, perPage = 10) {
  const url = `/api/sales/quote-catalog?q=${encodeURIComponent(q)}&page=${page}&per_page=${perPage}`;
  return api<{ items: QuoteCatalogItem[]; total: number }>(url, token);
}

export async function getCatalogItem(id: string, token: string) {
  return api<QuoteCatalogItem>(`/api/sales/quote-catalog/${id}`, token);
}

/** แนะนำค่าราย field จาก quote_catalog (part_no | description | cas_no | package_label | warn_text | sku) */
export type CatalogSuggestField = "part_no" | "description" | "cas_no" | "package_label" | "warn_text" | "sku";
export async function suggestCatalog(field: CatalogSuggestField, q: string, token: string, limit = 10) {
  const url = `/api/sales/quote-catalog/suggest/${field}?q=${encodeURIComponent(q)}&limit=${limit}`;
  return api<string[]>(url, token);
}

