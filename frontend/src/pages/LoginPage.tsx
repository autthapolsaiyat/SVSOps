// src/pages/LoginPage.tsx
import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation() as any;

  const [username, setU] = useState("admin");
  const [password, setP] = useState("admin");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setLoading(true);
    try {
      await login(username.trim(), password);
      const to = loc?.state?.from?.pathname || "/dashboard";
      nav(to, { replace: true });
    } catch (e: any) {
      setErr(e?.message || "Login failed");
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <form onSubmit={onSubmit} className="w-[380px] space-y-3 bg-zinc-900 p-6 rounded-xl border border-zinc-700">
        <h1 className="text-xl font-semibold">Sign in</h1>
        {err && <div className="text-sm text-red-400">{err}</div>}
        <div className="space-y-1">
          <label className="text-sm">Username</label>
          <input className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-700" value={username} onChange={e=>setU(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-sm">Password</label>
          <input type="password" className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-700" value={password} onChange={e=>setP(e.target.value)} />
        </div>
        <button type="submit" disabled={loading} className="w-full py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-60">
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}

