// FILE: src/lib/api.po.ts
import api from "@/lib/api.client";

export type PO = { id: string; number: string; vendor: string; status: string; created_at?: string };
export type POHeader = { id: string; number: string; vendor: string; status: string; created_at: string };
export type POItem = { product_id: string; sku: string; name: string; qty: number; price_ex_vat: number };
export type POGet = { header: POHeader; items: POItem[] };

export async function createPO(payload: { vendor: string; notes?: string; team_code?: string; company_code?: string; items: { product_id: string; qty: number; price_ex_vat: number }[] }): Promise<PO> {
  return await api.post<PO>("/purchases", payload);
}
export async function listPO(params?: { q?: string; page?: number; per_page?: number }): Promise<{ items: PO[]; total: number; page: number; per_page: number }> {
  const qs = new URLSearchParams();
  if (params?.q) qs.set("q", params.q);
  if (params?.page) qs.set("page", String(params.page));
  if (params?.per_page) qs.set("per_page", String(params.per_page));
  const suf = qs.toString() ? `?${qs.toString()}` : "";
  return await api.get(`/purchases${suf}`);
}
export async function getPO(id: string): Promise<POGet> {
  return await api.get(`/purchases/${id}`);
}
export async function receivePO(po_id: string): Promise<{ ok: boolean; status: string; stock_moves: { sku: string; qty: number; note: string }[] }> {
  return await api.post(`/purchases/${po_id}/receive`, {});
}

