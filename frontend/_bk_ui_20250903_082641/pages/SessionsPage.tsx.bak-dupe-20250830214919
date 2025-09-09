import { listSessions, revokeSession, logoutApi } from "@/lib/api.client";
// FILE: src/pages/SessionsPage.tsx
import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

type Session = {
  id: string;
  user_id?: string;
  ip?: string | null;
  user_agent?: string | null;
  created_at?: string;
  last_seen_at?: string;
  current?: boolean;
};

export default function SessionsPage() {
  const [items, setItems] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    setMsg(null);
    try {
      const data = await listSessions();
      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setMsg(`โหลดลิสต์เซสชันล้มเหลว: ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  }

  async function onRevoke(sid: string) {
    try {
      await revokeSession(sid);
      setMsg(`✅ revoked ${sid}`);
      await reload();
    } catch (e: any) {
      setMsg(`❌ revoke ล้มเหลว: ${e?.message || e}`);
    }
  }

  async function onLogoutAll() {
    try {
      await logoutApi();
      setMsg('✅ logout เรียบร้อย (token ปัจจุบันอาจใช้ไม่ได้แล้ว)');
    } catch (e: any) {
      setMsg(`❌ logout ล้มเหลว: ${e?.message || e}`);
    }
  }

  useEffect(() => { reload(); }, []);

  return (
    <div className="p-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Sessions</CardTitle>
          <div className="space-x-2">
            <Button variant="secondary" onClick={reload} disabled={loading}>Reload</Button>
            <Button variant="destructive" onClick={onLogoutAll}>Logout (server)</Button>
          </div>
        </CardHeader>
        <CardContent>
          {msg && <div className="mb-3 text-sm">{msg}</div>}
          {loading ? (
            <div>Loading...</div>
          ) : (
            <div className="space-y-2">
              {items.length === 0 && <div className="text-sm opacity-70">ไม่มีเซสชัน</div>}
              {items.map(s => (
                <div key={s.id} className="flex items-center justify-between border rounded p-2">
                  <div className="text-sm">
                    <div><b>{s.id}</b> {s.current ? '(current)' : ''}</div>
                    <div>last_seen: {s.last_seen_at || '-'}</div>
                    <div>ip: {s.ip || '-'}</div>
                    <div>ua: {s.user_agent || '-'}</div>
                  </div>
                  <Button variant="destructive" onClick={() => onRevoke(s.id)} disabled={s.current}>
                    Revoke
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
