// FILE: src/pages/QuotationDetailPage.tsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getQuote } from "@/lib/api.quotes";
import { useAuth } from "@/lib/auth.store";
import { QuoteActions } from "@/components/quotes/QuoteActions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

type QuoteStatus = "draft" | "sent" | "accepted" | "rejected" | "expired";

export default function QuotationDetailPage() {
  const { qid = "" } = useParams();
  const token = useAuth((s) => s.token)!;

  const [header, setHeader] = useState<any>();
  const [items, setItems] = useState<any[]>([]);
  const [totals, setTotals] = useState<any>();
  const status: QuoteStatus | undefined = header?.status;

  const load = async () => {
    try {
      const res = await getQuote(qid, token);
      setHeader(res.header);
      setItems(res.items || []);
      setTotals(res.totals || null);
    } catch (e: any) {
      toast.error(e.message || "โหลดใบเสนอราคาไม่สำเร็จ");
    }
  };

  useEffect(() => {
    if (qid && token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qid, token]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Quotation #{header?.number}</h1>
          <p className="text-sm text-muted-foreground">
            ลูกค้า: {header?.customer} • สถานะ: <b>{header?.status}</b>
          </p>
        </div>
        {status && (
          <QuoteActions qid={qid} status={status} token={token} onChanged={load} />
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>รายการสินค้า</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr className="text-left">
                  <th className="py-2 pr-2">SKU</th>
                  <th className="py-2 pr-2">Descriptions</th>
                  <th className="py-2 pr-2">Part No.</th>
                  <th className="py-2 pr-2">CAS</th>
                  <th className="py-2 pr-2">Package</th>
                  <th className="py-2 pr-2 text-right">Qty</th>
                  <th className="py-2 pr-2 text-right">Unit (ex VAT)</th>
                  <th className="py-2 pr-2">Catalog</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-b last:border-0">
                    <td className="py-2 pr-2">{it.sku}</td>
                    <td className="py-2 pr-2">{it.description ?? it.name}</td>
                    <td className="py-2 pr-2">{it.part_no ?? "-"}</td>
                    <td className="py-2 pr-2">{it.cas_no ?? "-"}</td>
                    <td className="py-2 pr-2">{it.package_label ?? "-"}</td>
                    <td className="py-2 pr-2 text-right">
                      {Number(it.qty ?? 0).toLocaleString()}
                    </td>
                    <td className="py-2 pr-2 text-right">
                      {Number(it.price_ex_vat ?? 0).toLocaleString()}
                    </td>
                    <td className="py-2 pr-2">{it.catalog_id ? "Yes" : "-"}</td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-muted-foreground">
                      ไม่มีรายการ
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ยอดรวม</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <Row label="รวมก่อนส่วนลด" value={totals?.subtotal_before_doc_discount} />
          <Row
            label="ส่วนลดเอกสาร"
            value={
              totals?.doc_discount_amount ??
              (totals?.doc_discount_rate != null
                ? `${(totals.doc_discount_rate * 100).toFixed(2)}%`
                : "-")
            }
          />
          <Row label="รวมหลังส่วนลด" value={totals?.subtotal} />
          <Row
            label={`VAT (${((totals?.vat_rate ?? 0) * 100).toFixed(2)}%)`}
            value={totals?.vat_amount}
          />
          <Row label="รวมสุทธิ" value={totals?.grand_total} strong />
        </CardContent>
      </Card>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: number | string | undefined | null;
  strong?: boolean;
}) {
  const V = typeof value === "number" ? value.toLocaleString() : value ?? "-";
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      {strong ? <b>{V}</b> : <span>{V}</span>}
    </div>
  );
}
