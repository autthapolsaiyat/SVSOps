// FILE: src/lib/api.quotes.ts
export async function api<T>(
  url: string,
  opts: RequestInit = {},
  token?: string
): Promise<T> {
  const res = await fetch(url, {
    ...opts,
    headers: {
      ...(opts.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const getQuote = (qid: string, token: string) =>
  api<{ header: any; items: any[]; totals: any }>(
    `/api/sales/quotations/${qid}`,
    {},
    token
  );

export const setQuoteStatus = (
  qid: string,
  status: "draft" | "sent" | "accepted" | "rejected" | "expired",
  token: string
) =>
  api<{ ok: boolean; status: string }>(
    `/api/sales/quotations/${qid}/status?status=${status}`,
    { method: "POST" },
    token
  );

export const toSO = (qid: string, token: string) =>
  api<{ id: string; number: string; status: string }>(
    `/api/sales/quotations/${qid}/to-so`,
    { method: "POST" },
    token
  );

export const importQuoteItems = (
  qid: string,
  file: File,
  mode: "append" | "replace",
  token: string
) => {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("mode", mode);
  return fetch(`/api/sales/quotations/${qid}/import`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  }).then(async (r) => {
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  });
};

