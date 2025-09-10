// FILE: src/lib/api.client.ts
import { authHeader } from "@/lib/auth";

/* ---------- API base ---------- */
function resolveApiBase(): string {
  const env = (import.meta as any).env?.VITE_API_BASE as string | undefined;
  if (env && env.trim()) return env.replace(/\/$/, "");
  try {
    const { hostname, port } = window.location;
    if (hostname === "localhost" && (port === "4173" || port === "5173")) {
      return "http://localhost:8080/api";
    }
  } catch {}
  return "/api";
}
const API_BASE = resolveApiBase();
const DEBUG_API = typeof window !== "undefined" && localStorage.getItem("DEBUG_API") === "1";

const fullUrl = (p: string) => `${API_BASE}${p.startsWith("/") ? p : `/${p}`}`;

function mergeHeaders(a?: HeadersInit, b?: HeadersInit): Headers {
  const h = new Headers();
  const apply = (src?: HeadersInit) => {
    if (!src) return;
    if (src instanceof Headers) src.forEach((v, k) => h.set(k, v));
    else Object.entries(src as Record<string, string>).forEach(([k, v]) => h.set(k, v as string));
  };
  apply(a); apply(b);
  return h;
}

export type ReqConfig = { headers?: HeadersInit; signal?: AbortSignal };

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = fullUrl(path);
  const method = (init.method || "GET").toUpperCase();
  const t0 = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();

  if (DEBUG_API) {
    let bodyPreview: any = undefined;
    try { bodyPreview = typeof init.body === "string" ? JSON.parse(init.body) : init.body; } catch {}
    console.debug("[API] →", method, url, bodyPreview ?? "");
  }

  const res = await fetch(url, { ...init, headers: mergeHeaders(authHeader(), init.headers) });

  const ms = Math.round(((typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now()) - t0);
  if (DEBUG_API) console.debug("[API] ←", res.status, method, url, `${ms}ms`);

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    if (DEBUG_API) console.error("[API] ✖", res.status, method, url, txt);
    throw new Error(txt || `${res.status} ${res.statusText}`);
  }
  if (res.status === 204) return undefined as unknown as T;
  return (await res.json()) as T;
}

/* ---------- Client ---------- */
export interface ApiClient {
  <T = any>(path: string, init?: RequestInit): Promise<T>;
  get<T = any>(path: string, config?: ReqConfig): Promise<T>;
  post<T = any>(path: string, data?: any, config?: ReqConfig): Promise<T>;
  put<T = any>(path: string, data?: any, config?: ReqConfig): Promise<T>;
  delete<T = any>(path: string, config?: ReqConfig): Promise<T>;
}
const base = (p: string, i?: RequestInit) => request<any>(p, i);
const client = base as ApiClient;

client.get =  <T>(p: string, c?: ReqConfig) => request<T>(p, { method: "GET", ...(c || {}) });
client.post = <T>(p: string, d?: any, c?: ReqConfig) =>
  request<T>(p, { method: "POST", headers: mergeHeaders({ "Content-Type": "application/json" }, c?.headers), body: d == null ? undefined : JSON.stringify(d), signal: c?.signal });
client.put =  <T>(p: string, d?: any, c?: ReqConfig) =>
  request<T>(p, { method: "PUT",  headers: mergeHeaders({ "Content-Type": "application/json" }, c?.headers), body: d == null ? undefined : JSON.stringify(d), signal: c?.signal });
client.delete = <T>(p: string, c?: ReqConfig) => request<T>(p, { method: "DELETE", ...(c || {}) });

export default client;
export const api = client;

/* ---------- Shims used by pages ---------- */
export type MeRow = { id: string; username: string; email?: string; roles?: string[]; permissions?: string[]; perms?: string[] };
export type MeResp = { ok: true; user: MeRow; perms: string[] };
export const meApi = async (): Promise<MeResp> => {
  const user = await api.get<MeRow>("/auth/me");
  const perms: string[] = (user as any).perms ?? (user as any).permissions ?? [];
  return { ok: true, user, perms };
};

export type UserStatus = "active" | "disabled" | "locked" | string;
export type UserRow = { id: string; username: string; email?: string; roles?: string[]; status?: UserStatus };
export const usersList   = () => api.get<UserRow[]>("/admin/users");
export const usersCreate = (payload: Partial<UserRow> & { password?: string }) => api.post<UserRow>("/admin/users", payload);
export const usersUpdate = (id: string, payload: Partial<UserRow> & { password?: string; status?: UserStatus }) =>
  api.put<UserRow>(`/admin/users/${id}`, payload);
export const usersDelete = (id: string) => api.delete<{ ok: boolean }>(`/admin/users/${id}`);

export type RoleRow = { id: string; name: string; description?: string; perms?: string[] };
export const rolesList     = () => api.get<RoleRow[]>("/admin/roles");
export const rolesCreate   = (payload: { name: string; description?: string }) => api.post<RoleRow>("/admin/roles", payload);
export const rolesUpdate   = (id: string, payload: Partial<RoleRow>) => api.put<RoleRow>(`/admin/roles/${id}`, payload);
export const rolesDelete   = (id: string) => api.delete<{ ok: boolean }>(`/admin/roles/${id}`);
export const rolesSetPerms = (id: string, perms: string[]) => api.put<RoleRow>(`/admin/roles/${id}/perms`, { perms });
export const permsList     = () => api.get<string[]>("/admin/perms");
export const permsCreate   = (arg: string | { name: string }) => {
  const name = typeof arg === "string" ? arg : arg?.name;
  return api.post<{ ok: boolean }>("/admin/perms", { perm: name });
};
export const permsDelete   = (perm: string) => api.delete<{ ok: boolean }>(`/admin/perms/${encodeURIComponent(perm)}`);

export type SessionRow = { id: string; user_agent?: string; created_at?: string; last_seen?: string };
export const listSessions  = () => api.get<SessionRow[]>("/auth/sessions");
export const revokeSession = (sid: string) => api.delete<{ ok: boolean }>(`/auth/sessions/${sid}`);
export const logoutApi     = () => api.post<{ ok: boolean }>("/auth/logout", {});

export const receiveCreate = (payload: any) => api.post<{ ok: boolean }>("/inventory/receive", payload);

export type Team = { id: string; code: string; name: string };
export type Customer = { id: string; name: string; team_id?: string };
export type Product = { id: string; sku: string; name: string; unit: string; price_ex_vat: number | string };
export type UUID = string;
export type DashboardSummary = {
  totals?: { products?: number; customers?: number; stock_on_hand?: number; reserved?: number };
  month_docs?: { quotations?: number; pos?: number; sos?: number };
};
export const commonApi = {
  teams: (q = "") => api.get<Team[]>(`/teams${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  customers: (opts: { q?: string; team_id?: string }) =>
    api.get<Customer[]>(`/customers?${new URLSearchParams(Object.entries(opts).filter(([, v]) => v != null && v !== "") as any).toString()}`),
  products: (opts: { q?: string; team_id?: string; page?: number; page_size?: number }) =>
    api.get<Product[]>(`/products?${new URLSearchParams(Object.entries(opts).filter(([, v]) => v != null && v !== "") as any).toString()}`),
  dashboardSummary: () => api.get<DashboardSummary>("/dashboard/summary"),
};
