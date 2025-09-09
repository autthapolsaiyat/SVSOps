// FILE: src/lib/api.products.tsx
import api from "@/lib/api.client";
import { authHeader } from "@/lib/auth";

/** Types */
export type Product = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  // backend may return string e.g. "1234.00"
  price_ex_vat: number | string;
  team_id?: string;
  cas_no?: string | null;
};

export type ProductList = {
  items: Product[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
};

export type ListParams = {
  q?: string;
  page?: number;
  per_page?: number;
  sort?: "sku" | "name" | "unit" | "price_ex_vat" | "cas_no";
  order?: "asc" | "desc";
  team_id?: string;
};

export type CreateProductPayload = {
  sku: string;
  name: string;
  unit: string;
  price_ex_vat: number | string;
  team_id?: string;       // required on INSERT if DB enforces NOT NULL
  cas_no?: string | null; // optional
};

export type DeleteResult = { ok: boolean } | Product;

export type ImportSummary = {
  inserted: number;
  updated: number;
  skipped?: number;
  failed: number;
  errors?: Array<{ row: number; sku?: string; error: string }>;
};

/** Helpers */
function baseURL() {
  // แนะนำให้ใช้ /api ใน dev ผ่าน Vite proxy; แต่คง fallback เดิมไว้
  return ((import.meta as any).env?.VITE_API_BASE as string) ?? "http://localhost:8080/api";
}
function buildURL(path: string) {
  const a = baseURL().replace(/\/+$/, "");
  const b = path.startsWith("/") ? path : `/${path}`;
  return `${a}${b}`;
}
function buildQuery(params: ListParams = {}): string {
  const qs = new URLSearchParams();
  const q = params.q?.trim();
  if (q) qs.set("q", q);
  if (params.page) qs.set("page", String(params.page));
  if (params.per_page) qs.set("per_page", String(params.per_page));
  if (params.sort) qs.set("sort", params.sort);
  if (params.order) qs.set("order", params.order);
  if (params.team_id) qs.set("team_id", params.team_id);
  const s = qs.toString();
  return s ? `?${s}` : "";
}

/** Normalize list responses */
function normalizeList(
  res: ProductList | Product[] | undefined | null,
  params?: ListParams
): ProductList {
  const page = params?.page ?? 1;
  const per_page = (params?.per_page ?? 10) || 10;

  if (!res) return { items: [], total: 0, page, per_page, pages: 1 };

  if (Array.isArray(res)) {
    const items = res;
    const total = items.length;
    const pages = Math.max(1, Math.ceil(total / Math.max(1, per_page)));
    return { items, total, page, per_page, pages };
  }

  const safeItems = Array.isArray(res.items) ? res.items : [];
  const total = Number(res.total ?? safeItems.length) || safeItems.length;
  const pages =
    Number((res as any).pages) ||
    Math.max(1, Math.ceil(total / Math.max(1, per_page)));
  return { items: safeItems, total, page, per_page, pages };
}

/** API */
export async function listProducts(params: ListParams = {}): Promise<ProductList> {
  const suffix = buildQuery(params); // '' หรือ '?q=...'
  const res = await api.get<ProductList | Product[]>(`/products/${suffix}`);
  return normalizeList(res, params);
}

export async function createProduct(
  p: CreateProductPayload,
  mode: "error" | "return" | "upsert" = "upsert"
): Promise<Product> {
  return await api.post<Product>(`/products/?on_conflict=${mode}`, p);
}

export async function updateProduct(
  id: string,
  p: Partial<CreateProductPayload>
): Promise<Product> {
  try {
    return await api.put<Product>(`/products/${id}`, p);
  } catch {
    return await api.put<Product>(`/products/${id}/`, p);
  }
}

export async function deleteProduct(id: string): Promise<DeleteResult> {
  try {
    return await api.delete<DeleteResult>(`/products/${id}`);
  } catch {
    return await api.delete<DeleteResult>(`/products/${id}/`);
  }
}

/** CSV Export / Import */
export async function exportProductsCSV(params: ListParams = {}) {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.sort) qs.set("sort", params.sort);
  if (params.order) qs.set("order", params.order);
  if (params.team_id) qs.set("team_id", params.team_id);

  let url = buildURL("/products/export-csv");
  if (qs.toString()) url += `?${qs.toString()}`;

  let res = await fetch(url, { headers: authHeader() });
  if (!res.ok) {
    const alt = buildURL(`/products/export${qs.toString() ? `?${qs.toString()}` : ""}`);
    res = await fetch(alt, { headers: authHeader() });
    if (!res.ok) throw new Error(`Export failed: ${res.status} ${res.statusText}`);
  }

  const blob = await res.blob();
  const urlObj = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const ts = new Date().toISOString().replace(/[-:TZ]/g, "").slice(0, 14);
  a.href = urlObj;
  a.download = `products_${ts}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(urlObj);
}

/** Robust importer */
export async function importProducts(
  file: File,
  mode: "upsert" | "replace" = "upsert",
  defaultTeamId?: string
): Promise<ImportSummary> {
  const qs = new URLSearchParams({ mode });
  if (defaultTeamId) qs.set("default_team_id", defaultTeamId);

  const form = new FormData();
  form.append("file", file);

  // รองรับ Excel หลายนามสกุล
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const isExcel = ext === "xlsx" || ext === "xls" || ext === "xlsm";

  // Excel -> /import (POST) | CSV -> /import-csv (PUT) + fallback
  const tryPlan: Array<{ url: string; method: "PUT" | "POST" }> = isExcel
    ? [
        { url: buildURL(`/products/import?${qs.toString()}`), method: "POST" },
        { url: buildURL(`/products/import-csv?${qs.toString()}`), method: "PUT" },
        { url: buildURL(`/products/import?${qs.toString()}`), method: "PUT" },
      ]
    : [
        { url: buildURL(`/products/import-csv?${qs.toString()}`), method: "PUT" },
        { url: buildURL(`/products/import?${qs.toString()}`), method: "POST" },
      ];

  let lastErr: any = null;
  for (const step of tryPlan) {
    try {
      const res = await fetch(step.url, {
        method: step.method,
        headers: authHeader(), // อย่าตั้ง Content-Type เอง ให้ browser จัด boundary
        body: form,
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`${res.status} ${res.statusText}${txt ? ` — ${txt.slice(0, 300)}` : ""}`);
      }
      return (await res.json()) as ImportSummary;
    } catch (e) {
      lastErr = e;
    }
  }
  const hint =
    (lastErr?.message || "").includes("Failed to fetch")
      ? " (เช็กพอร์ต 8080, CORS, หรือ reverse-proxy ที่บล็อกไฟล์ใหญ่)"
      : "";
  throw new Error(`Import failed: ${String(lastErr?.message || lastErr)}${hint}`);
}

// Back-compat alias: ให้โค้ดเก่าเรียกชื่อเดิมได้
export const importProductsCSV = importProducts;

