// FILE: src/lib/debug.client.ts
export type DebugEntry = {
  ts?: number; level?: 'info'|'warn'|'error'|'debug'|'net'; source?: 'fe'|'be'|'net';
  message: string; data?: any; context?: any;
};

function resolveApiBase() {
  const env = (import.meta as any).env?.VITE_API_BASE as string | undefined;
  if (env && env.trim()) return env.replace(/\/$/, "");
  // under nginx/proxy (8081/8888), use /api
  return "/api";
}
const API = resolveApiBase();

export async function sendLog(e: DebugEntry) {
  const body = { ts: e.ts ?? Date.now()/1000, level: e.level ?? 'info', source: e.source ?? 'fe', message: e.message, data: e.data, context: e.context };
  await fetch(`${API}/debug/log`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(()=>{});
}

export async function fetchLogs(limit=200): Promise<DebugEntry[]> {
  const r = await fetch(`${API}/debug/logs?limit=${limit}`); return r.ok ? (await r.json()) as DebugEntry[] : [];
}

export function connectStream(onEvent: (e: DebugEntry)=>void): EventSource {
  // EventSource needs absolute for preview; relative works behind nginx
  const url = `${API}/debug/stream`;
  const es = new EventSource(url);
  es.onmessage = (ev) => {
    try { const obj = JSON.parse(ev.data); onEvent(obj); } catch {}
  };
  return es;
}

