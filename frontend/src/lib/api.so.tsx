// FILE: src/lib/api.so.ts
import api from "@/lib/api.client";

export type SO = { id: string; number: string; customer: string; status: string; created_at?: string };
export type SOHeader = { id: string; number: string; customer: string; status: string; created_at: string };
export type SOItem = { product_id: string; sku: string; name: string; qty: number; price_ex_vat: number };
export type SOGet = { header: SOHeader; items: SOItem[] };

export async function createSO(payload: { customer: string; notes?: string; team_code?: string; company_code?: string; items: { product_id: string; qty: number; price_ex_vat: number }[] }): Promise<SO> {
  return await api.post<SO>("/sales", payload);
}
export async function listSO(params?: { q?: string; page?: number; per_page?: number }): Promise<{ items: SO[]; total: number; page: number; per_page: number }> {
  const qs = new URLSearchParams();
  if (params?.q) qs.set("q", params.q);
  if (params?.page) qs.set("page", String(params.page));
  if (params?.per_page) qs.set("per_page", String(params.per_page));
  const suf = qs.toString() ? `?${qs.toString()}` : "";
  return await api.get(`/sales${suf}`);
}
export async function getSO(id: string): Promise<SOGet> {
  return await api.get(`/sales/${id}`);
}
export async function fulfillSO(so_id: string): Promise<{ ok: boolean; status: string; stock_moves: { sku: string; qty: number; note: string }[] }> {
  return await api.post(`/sales/${so_id}/fulfill`, {});
}

