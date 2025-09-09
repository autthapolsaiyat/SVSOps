// FILE: src/pages/LoginPage.tsx
import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AuthUser = {
  id: string; username: string;
  roles?: string[]; perms?: string[];
};

function resolveApiBase() {
  // 1) ถ้ากำหนดไว้ใน env ให้ใช้ก่อน
  const env = (import.meta as any).env?.VITE_API_BASE as string | undefined;
  if (env && env.trim()) return env.replace(/\/$/, "");
  // 2) dev preview (5173/4173) → ชี้ backend ตรง (คุณเคยทดสอบผ่านแล้ว)
  try {
    const { hostname, port } = window.location;
    if (hostname === "localhost" && (port === "4173" || port === "5173")) {
      return "http://localhost:8080/api";
    }
  } catch {}
  // 3) ค่าเริ่มต้น (prod ผ่าน reverse-proxy)
  return "/api";
}

async function jsonOrText(res: Response) {
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { message: text }; }
}

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();
  const loc = useLocation();

  const API_BASE = resolveApiBase();
  const LOGIN_URL = `${API_BASE}/auth/login`;
  const ME_URL    = `${API_BASE}/auth/me`;

  async function doLogin() {
    const u = username.trim();
    const p = password;
    if (!u || !p) { toast.error("กรอกชื่อผู้ใช้และรหัสผ่าน"); return; }

    setLoading(true);
    try {
      console.info("[login] POST", LOGIN_URL);
      const res = await fetch(LOGIN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u, password: p }),
      });
      if (!res.ok) {
        const body = await jsonOrText(res);
        const detail = (body?.detail ?? body?.message ?? "").toString();
        // ช่วย debug กรณี 404 จาก Vite proxy/BASE ผิด
        if (res.status === 404) {
          const hint = API_BASE === "/api"
            ? "404 จาก /api → ตรวจ vite.config.ts server.proxy หรือใช้ VITE_API_BASE=http://localhost:8080/api"
            : "404 จากปลายทาง backend ให้ตรวจเส้นทาง /auth/login";
          throw new Error(`404 Not Found (${hint})`);
        }
        throw new Error(detail || `${res.status} ${res.statusText}`);
      }
      const data = await res.json();
      const token = data?.access_token as string | undefined;
      if (!token) throw new Error("ไม่พบ access_token");

      // ดึงข้อมูลผู้ใช้
      const meRes = await fetch(ME_URL, { headers: { Authorization: `Bearer ${token}` } });
      if (!meRes.ok) {
        const body = await jsonOrText(meRes);
        throw new Error(`/auth/me ${meRes.status}: ${body?.detail ?? body?.message ?? meRes.statusText}`);
      }
      const me = (await meRes.json()) as AuthUser;

      // เก็บ session (ให้เข้ากันกับโค้ดส่วนอื่น)
      localStorage.setItem("access_token", token);
      localStorage.setItem("token", token);            // เผื่อที่อื่นอ้าง key นี้
      localStorage.setItem("auth_user", JSON.stringify(me));
      localStorage.setItem("auth_perms", JSON.stringify(me.perms || []));
      localStorage.setItem("last_login_user", u);

      toast.success(`Welcome ${me.username ?? u}`);
      const next = new URLSearchParams(loc.search).get("next");
      nav(next || "/products", { replace: true });
    } catch (err: any) {
      console.error("[login] failed:", err);
      const msg = String(err?.message || err);
      toast.error(
        msg.includes("401") ? "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง"
        : msg.startsWith("404") ? msg
        : `Login failed: ${msg}`
      );
    } finally {
      setLoading(false);
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") { e.preventDefault(); doLogin(); }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-background text-foreground">
      {/* ไม่ใช้ <form> เพื่อกัน browser POST /login */}
      <div className="w-[380px] rounded-2xl border border-border bg-card p-6 shadow
                      dark:bg-[#0f172a] dark:border-[#1f2937]">
        <h1 className="text-xl font-semibold mb-4">Sign in</h1>

        <div className="space-y-2 mb-3">
          <label className="text-sm text-muted-foreground">Username</label>
          <Input autoFocus value={username} onChange={(e)=>setUsername(e.target.value)} onKeyDown={onKey}/>
        </div>

        <div className="space-y-2 mb-4">
          <label className="text-sm text-muted-foreground">Password</label>
          <Input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} onKeyDown={onKey}/>
        </div>

        <Button type="button" onClick={doLogin} disabled={loading || !username || !password} className="w-full">
          {loading ? "Signing in..." : "Sign in"}
        </Button>

        {/* debug base */}
        <div className="mt-3 text-xs text-muted-foreground">API: {API_BASE}</div>
      </div>
    </div>
  );
}

