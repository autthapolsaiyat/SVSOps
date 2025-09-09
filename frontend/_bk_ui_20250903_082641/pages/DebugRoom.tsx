// FILE: src/pages/DebugRoom.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { connectStream, fetchLogs, sendLog, type DebugEntry } from "@/lib/debug.client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type NetRec = { method: string; url: string; status?: number; ms?: number; reqSize?: number; resSize?: number };

function useFetchInterceptor(enabled: boolean, push: (e: DebugEntry)=>void) {
  useEffect(() => {
    if (!enabled) return;
    const orig = window.fetch;
    // @ts-ignore
    if ((window as any).__dbgFetchPatched) return;
    // @ts-ignore
    (window as any).__dbgFetchPatched = true;

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = (init?.method || 'GET').toUpperCase();
      const url = (typeof input === 'string' ? input : (input as URL).toString());
      const t0 = performance.now();
      let status = 0, resSize = 0;
      try {
        const res = await orig(input, init);
        status = res.status;
        try { const clone = res.clone(); const buf = await clone.arrayBuffer(); resSize = buf.byteLength; } catch {}
        const ms = Math.round(performance.now() - t0);
        push({ ts: Date.now()/1000, level: 'net', source: 'fe', message: `${method} ${url}`, data: { status, ms, resSize } });
        return res;
      } catch (e:any) {
        const ms = Math.round(performance.now() - t0);
        push({ ts: Date.now()/1000, level: 'error', source: 'fe', message: `${method} ${url} ✖ ${e?.message||e}`, data: { status, ms } });
        throw e;
      }
    };
    return () => { window.fetch = orig; };
  }, [enabled, push]);
}

export default function DebugRoom() {
  const [entries, setEntries] = useState<DebugEntry[]>([]);
  const [mirror, setMirror] = useState(true);
  const [captureNet, setCaptureNet] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const push = (e: DebugEntry) => {
    setEntries((prev) => [...prev.slice(-499), e]);
    if (mirror) sendLog(e).catch(()=>{});
  };

  useFetchInterceptor(captureNet, push);

  useEffect(() => {
    let es: EventSource | null = null;
    (async () => {
      const boot = await fetchLogs(100);
      setEntries(boot);
      es = connectStream((e) => setEntries((prev)=>[...prev.slice(-499), e]));
    })();
    return () => { if (es) es.close(); };
  }, []);

  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:'smooth'}); }, [entries]);

  const env = useMemo(()=>({
    origin: window.location.origin,
    userAgent: navigator.userAgent,
    storageKeys: Object.keys(localStorage),
  }), []);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Debug Room</h1>
        <div className="flex items-center gap-2">
          <label className="text-sm flex items-center gap-1">
            <input type="checkbox" checked={captureNet} onChange={e=>setCaptureNet(e.target.checked)} /> capture fetch()
          </label>
          <label className="text-sm flex items-center gap-1">
            <input type="checkbox" checked={mirror} onChange={e=>setMirror(e.target.checked)} /> mirror to /api/debug/log
          </label>
          <Button onClick={()=>sendLog({message:"manual ping", level:"info"})}>Send test</Button>
          <Button variant="secondary" onClick={()=>setEntries([])}>Clear local</Button>
          <Button variant="secondary" onClick={()=>fetch("/api/debug/flush",{method:"POST"})}>Flush server</Button>
        </div>
      </div>

      <Card className="bg-card border border-border">
        <CardHeader><CardTitle>Environment</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div>Origin: <code>{env.origin}</code></div>
          <div>UserAgent: <code>{env.userAgent}</code></div>
          <div>LocalStorage keys: <code>{env.storageKeys.join(", ") || "—"}</code></div>
        </CardContent>
      </Card>

      <Card className="bg-card border border-border">
        <CardHeader><CardTitle>Live Logs (SSE + local capture)</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table className="bg-transparent">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[160px]">Time</TableHead>
                <TableHead className="w-[80px]">Level</TableHead>
                <TableHead className="w-[80px]">Source</TableHead>
                <TableHead>Message</TableHead>
                <TableHead className="w-[200px]">Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e, i) => (
                <TableRow key={i}>
                  <TableCell className="font-mono">{new Date((e.ts ?? Date.now()/1000)*1000).toISOString().replace('T',' ').replace('Z','')}</TableCell>
                  <TableCell>{e.level}</TableCell>
                  <TableCell>{e.source}</TableCell>
                  <TableCell className="font-mono break-all">{e.message}</TableCell>
                  <TableCell className="font-mono break-all">{e.data ? JSON.stringify(e.data) : ""}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div ref={bottomRef} />
        </CardContent>
      </Card>
    </div>
  );
}

