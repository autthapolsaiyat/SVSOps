// FILE: src/lib/api.salesreps.ts
import api from "./api.client";

export type SalesRepRow = {
  user_id: string;
  username: string;
  user_email?: string;
  full_name?: string | null;
  phone?: string | null;
  rep_email?: string | null;
};

export async function listSalesReps(): Promise<SalesRepRow[]> {
  return await api.get<SalesRepRow[]>("/sales/quotations/sales-reps");
}

export async function upsertSalesRep(
  user_id: string,
  payload: { full_name: string; phone?: string; email?: string }
): Promise<{ ok: boolean }> {
  return await api.put<{ ok: boolean }>(`/sales/quotations/sales-reps/${user_id}`, payload);
}

