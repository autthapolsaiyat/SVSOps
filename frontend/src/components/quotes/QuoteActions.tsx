// FILE: src/components/quotes/QuoteActions.tsx
import { useState } from "react";
import { setQuoteStatus, toSO } from "@/lib/api.quotes";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type QuoteStatus = "draft" | "sent" | "accepted" | "rejected" | "expired";

export function QuoteActions({
  qid,
  status,
  token,
  onChanged,
}: {
  qid: string;
  status: QuoteStatus;
  token: string;
  onChanged: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const doSend = async () => {
    try {
      setLoading(true);
      await setQuoteStatus(qid, "sent", token);
      toast.success("ส่งใบเสนอราคาแล้ว");
      onChanged();
    } catch (e: any) {
      toast.error(e.message || "ส่งไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const doAccept = async () => {
    try {
      setLoading(true);
      await setQuoteStatus(qid, "accepted", token);
      toast.success("ลูกค้าตกลงแล้ว");
      onChanged();
    } catch (e: any) {
      toast.error(e.message || "เปลี่ยนสถานะไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const doCreateSO = async () => {
    try {
      setLoading(true);
      const so = await toSO(qid, token);
      toast.success(`สร้าง SO: ${so.number}`);
      // TODO: ถ้ามีหน้า SO แยก ให้ navigate ไปหน้า SO ที่นี่
    } catch (e: any) {
      toast.error(e.message || "สร้าง SO ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex gap-2">
      {status === "draft" && (
        <Button onClick={doSend} disabled={loading}>
          ส่งให้ลูกค้า
        </Button>
      )}
      {status === "sent" && (
        <Button onClick={doAccept} disabled={loading}>
          ลูกค้าตกลง
        </Button>
      )}
      {status === "accepted" && (
        <Button onClick={doCreateSO} disabled={loading}>
          สร้าง SO
        </Button>
      )}
    </div>
  );
}

