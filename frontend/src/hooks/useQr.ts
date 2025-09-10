// FILE: src/hooks/useQr.ts
export type QrResult =
  | { type: "product"; sku: string }
  | { type: "so"; no: string }
  | { type: "loc"; code: string }
  | { type: "url"; url: string }
  | { type: "text"; text: string };

export function parseQr(text: string): QrResult {
  try {
    // URL ที่มี query: ?p=, ?so=, ?loc=
    if (text.startsWith("http://") || text.startsWith("https://")) {
      const u = new URL(text);
      const p  = u.searchParams.get("p");
      const so = u.searchParams.get("so");
      const loc= u.searchParams.get("loc");
      if (p)   return { type: "product", sku: p };
      if (so)  return { type: "so", no: so };
      if (loc) return { type: "loc", code: loc };
      return { type: "url", url: text };
    }
    // รูปแบบรหัสสั้น ๆ เช่น SO-0001 / SKU-001 / LOC-A01
    if (/^SO[-_ ]?\d+/i.test(text)) return { type: "so", no: text.replace(/\s/g,"") };
    if (/^SKU[-_ ]?[A-Za-z0-9]+/i.test(text)) return { type: "product", sku: text.trim() };
    if (/^LOC[-_ ]?/i.test(text)) return { type: "loc", code: text.trim() };
    return { type: "text", text };
  } catch {
    return { type: "text", text };
  }
}

