// FILE: src/pages/SimpleAuthPage.tsx
import React, { useEffect, useState } from "react";
import { login, getUser, getPerms, logout, listenAuth401 } from "@/lib/auth";

export default function SimpleAuthPage() {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // ถ้าโดน 401: ล้าง session แล้วเด้งกลับ /login พร้อม next
  useEffect(() => {
    const off = listenAuth401(() => {
      logout();
      const { pathname, search } = window.location;
      const next = encodeURIComponent(`${pathname}${search}`);
      window.location.href = `/login?next=${next}`;
    });
    return () => { off(); };
  }, []);

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      await login(username, password); // จะเซฟ token และ /auth/me ให้อัตโนมัติ
      const u = getUser(); 
      const p = getPerms();
      setMsg(`✅ Login OK: ${u?.username ?? username} (roles=${u?.roles?.join(",") || "-"}) perms=${p.length}`);
    } catch (e: any) {
      setMsg(`❌ ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  }

  function onShowProfile() {
    const u = getUser(); 
    const p = getPerms();
    setMsg(`👤 ${u?.username || "-"} roles=${u?.roles?.join(",") || "-"} perms=${p.length}`);
  }

  function onLogout() {
    logout();
    setMsg("🚪 Logged out (local cleared)");
  }

  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <form onSubmit={onLogin} style={{border:"1px solid #ddd",padding:16,borderRadius:12,width:360}}>
        <h3 style={{marginBottom:12}}>Test Login UI</h3>
        <div style={{display:"grid",gap:8}}>
          <label>
            <div style={{fontSize:12,opacity:.8}}>Username</div>
            <input value={username} onChange={e=>setUsername(e.target.value)} placeholder="admin" />
          </label>
          <label>
            <div style={{fontSize:12,opacity:.8}}>Password</div>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="admin" />
          </label>
          <button type="submit" disabled={loading} style={{padding:"8px 12px"}}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
          <button type="button" onClick={onShowProfile} style={{padding:"8px 12px"}}>
            Show Profile (/auth/me)
          </button>
          <button type="button" onClick={onLogout} style={{padding:"8px 12px"}}>
            Logout (clear local)
          </button>
          {msg && <div style={{fontSize:12,whiteSpace:"pre-wrap"}}>{msg}</div>}
        </div>
      </form>
    </div>
  );
}

