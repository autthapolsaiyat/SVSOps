// FILE: src/lib/api.quotes.ts
import { authHeader } from "@/lib/auth";

export async function getQuote(qid: string, token: string) {
  const res = await fetch(`/api/sales/quotations/${qid}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function setQuoteStatus(qid: string, status: "draft"|"sent"|"accepted"|"rejected"|"expired", token: string) {
  const res = await fetch(`/api/sales/quotations/${qid}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function toSO(qid: string, token: string) {
  const res = await fetch(`/api/sales/quotations/${qid}/to-so`, {
    method: "POST",
    headers: { ...authHeader(), Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

