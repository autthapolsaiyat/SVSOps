import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { meApi } from "@/lib/api.client";

type MeResp = { ok: boolean; user: { id: string; username: string }; perms: string[] };

export default function MePage() {
  const [me, setMe] = useState<MeResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try { setMe(await meApi()); }
      catch (e: any) { setErr(e?.message || String(e)); }
      finally { setLoading(false); }
    })();
  }, []);

  const card = "bg-card dark:bg-[#0f172a] border border-border dark:border-[#1f2937]";

  if (loading) return <div className="p-6 text-muted-foreground">Loading…</div>;
  if (err) return <div className="p-6 text-red-500">{err}</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <Card className={card}>
        <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><div className="text-muted-foreground">Username:</div><div>{me?.user.username}</div></div>
          <div><div className="text-muted-foreground">Email:</div><div className="text-muted-foreground">—</div></div>
        </CardContent>
      </Card>

      <Card className={card}>
        <CardHeader><CardTitle>Roles ({(me?.perms?.length ?? 0) > 0 ? 2 : 0})</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {/* แสดงตัวอย่าง role จาก JWT จริง ๆ ในระบบคุณได้ตามที่มี */}
            <span className="px-2 py-0.5 rounded-full ring-1 ring-border bg-muted text-muted-foreground">sysop</span>
            <span className="px-2 py-0.5 rounded-full ring-1 ring-border bg-muted text-muted-foreground">superadmin</span>
          </div>
        </CardContent>
      </Card>

      <Card className={card}>
        <CardHeader><CardTitle>Permissions ({me?.perms?.length ?? 0})</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {(me?.perms ?? []).map((p) => (
            <span key={p} className="px-2 py-0.5 rounded-full ring-1 ring-border bg-muted text-muted-foreground">{p}</span>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

