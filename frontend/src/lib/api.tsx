// FILE: src/lib/api.ts
//------------------------------------------------------------
import { api } from './api.client';

export type UUID = string;
export type Team = { id: UUID; code?: string; name: string };
export type Customer = { id: UUID; code?: string; name: string };
export type Product = { id: UUID; sku: string; name: string; unit: string; price_ex_vat: number | string; team_id?: UUID };
export type SOItemDraft = { product_id: UUID; qty: number; price_ex_vat?: number };
export type SalesOrder = { id: UUID; so_no: string; status: 'draft'|'confirmed'|'issued'; created_at: string };
export type DashboardSummary = { soOpen: number; ivIssued: number; stockSku: number };

const qs = (o: Record<string, any>) => Object.entries(o)
  .filter(([,v]) => v !== undefined && v !== '')
  .map(([k,v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
  .join('&');

export const Api = {
  teams: (q = '') => api<Team[]>(`/teams${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  customers: (opts: { q?: string; team_id?: string }) => api<Customer[]>(`/customers?${qs(opts)}`),
  products: (opts: { q?: string; team_id: string; page?: number; page_size?: number }) => api<Product[]>(`/products?${qs(opts)}`),

  createSO: (payload: { team_id: UUID; customer_id: UUID; items: SOItemDraft[] }) =>
    api<{ id: UUID; so_no: string }>(`/sales-orders`, { method: 'POST', body: JSON.stringify(payload) }),
  listSO: (status?: string) => api<SalesOrder[]>(`/sales-orders${status ? `?status=${status}` : ''}`),
  confirmSO: (id: UUID) => api<{ id: UUID; so_no: string; status: string }>(`/sales-orders/${id}/confirm`, { method: 'POST' }),
  issueIV: (id: UUID) => api<{ id: UUID; iv_no: string; status: string }>(`/sales-orders/${id}/issue-iv`, { method: 'POST' }),

  dashboardSummary: () => api<DashboardSummary>(`/dashboard/summary`),
};
