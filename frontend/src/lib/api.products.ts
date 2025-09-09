// FILE: src/lib/api.products.ts
export type TeamItem = { code: string; label?: string; name?: string };
export type GroupItem = { code: string; name?: string; label?: string };
export type Product = {
  sku: string; name: string; unit?: string;
  team_code?: string; group_code?: string; group_name?: string;
  is_domestic?: boolean | null;
};
export type ProductList = { items: Product[]; total: number; page?: number; pages?: number };

// ---- BASE & ENV ----
const rawBase = (import.meta.env.VITE_API_BASE as string | undefined) ?? "/api";
// ถ้าใส่มาเป็น URL เต็ม (http://...) ให้บังคับใช้ proxy path /api แทน เพื่อรองรับเปิดผ่าน IP/LAN
const API_BASE = /^https?:\/\//i.test(rawBase) ? "/api" : rawBase;

const DEFAULT_TEAM_ID = import.meta.env.VITE_DEFAULT_TEAM_ID as string | undefined;

function authHeaders() {
  const token = localStorage.getItem("token") || "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  // path ควรเริ่มด้วย "/products/..." หรือ "/..." เสมอ
  const url = `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...authHeaders(),
    ...(init?.headers as Record<string, string> | undefined),
  };

  // ใส่ X-Team-Id อัตโนมัติถ้ายังไม่มี
  if (DEFAULT_TEAM_ID && !("X-Team-Id" in headers)) {
    headers["X-Team-Id"] = DEFAULT_TEAM_ID;
  }
  // ใส่ Content-Type เฉพาะเมื่อมี body
  const hasBody = init?.body != null;
  if (hasBody && !("Content-Type" in headers)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, {
    credentials: "include",
    ...init,
    headers,
  });

  const raw = await res.text();
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j = raw ? JSON.parse(raw) : null;
      msg = j?.detail || j?.message || msg;
    } catch {}
    throw new Error(`HTTP ${res.status}: ${msg}`);
  }
  return raw ? (JSON.parse(raw) as T) : (undefined as unknown as T);
}

// ---- Masters ----
export async function listTeams(): Promise<{ items: TeamItem[] }> {
  const r = await fetchJSON<{ items: { code: string; label?: string }[] }>("/products/teams");
  return { items: (r.items || []).map((it) => ({ code: it.code, label: it.label })) };
}

export async function listGroups(): Promise<{ items: GroupItem[] }> {
  const r = await fetchJSON<{ items: { code: string; label?: string; name?: string }[] }>("/products/groups");
  return { items: (r.items || []).map((it) => ({ code: it.code, name: it.name ?? it.label })) };
}

// ---- Products ----
export async function listProducts(qs: {
  q?: string; page?: number; per_page?: number; sort?: string; order?: "asc" | "desc";
  origin?: "all" | "domestic" | "foreign" | "unassigned"; team_code?: string; group_code?: string;
}): Promise<ProductList> {
  const limit = qs.per_page ?? 10;
  const offset = ((qs.page ?? 1) - 1) * limit;
  const params = new URLSearchParams();
  if (qs.q) params.set("q", qs.q);
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  if (qs.sort) params.set("sort", qs.sort);
  if (qs.order) params.set("order", qs.order);
  if (qs.origin && qs.origin !== "all") params.set("origin", qs.origin);
  if (qs.team_code) params.set("team_code", qs.team_code);
  if (qs.group_code) params.set("group_code", qs.group_code);
  return fetchJSON<ProductList>(`/products/list?${params.toString()}`);
}

export async function getProductBySku(sku: string): Promise<Product | { item?: Product | null }> {
  return fetchJSON<Product | { item?: Product | null }>(`/products/get?sku=${encodeURIComponent(sku)}`);
}

export async function upsertProduct(body: {
  sku?: string; code?: string; name: string; unit?: string;
  price?: number | string | null;
  team_id?: string | null;
  team_code?: string | null;
  group_code?: string | null;
  group_name?: string | null;
  is_domestic?: boolean | null;
  group_tag?: string | null;
}): Promise<{ id: string; sku: string; name: string; unit?: string }> {
  const price_ex_vat =
    body.price === null || body.price === undefined || body.price === "" ? 0 :
    typeof body.price === "string" ? Number(body.price) : body.price;

  const payload: any = {
    sku: body.sku ?? body.code,
    name: body.name,
    unit: body.unit ?? "EA",
    price_ex_vat,
    // ส่วนเสริม (ถ้า backend เฉย ๆ ก็ไม่เป็นไร)
    team_code: body.team_code ?? undefined,
    group_code: body.group_code ?? undefined,
    group_name: body.group_name ?? undefined,
    is_domestic: typeof body.is_domestic === "boolean" ? body.is_domestic : undefined,
    group_tag: body.group_tag ?? undefined,
    team_id: body.team_id ?? undefined,
  };

  return fetchJSON<{ id: string; sku: string; name: string; unit?: string }>(
    "/products/upsert",
    { method: "POST", body: JSON.stringify(payload) }
  );
}

