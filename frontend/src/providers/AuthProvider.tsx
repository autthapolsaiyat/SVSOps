import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type AuthUser = {
  username: string;
  roles: string[];
  permissions?: string[]; // API ปัจจุบัน
  perms?: string[];       // รองรับโค้ดเดิมที่เรียก perms
};

type AuthCtx = {
  token: string | null;
  me: AuthUser | null;
  loading: boolean;
  login: (u: string, p: string) => Promise<boolean>;
  logout: () => void;
  isSuperadmin: boolean;
  can: (perm: string) => boolean;
  roles: string[];
  perms: string[]; // ✅ ให้มีค่า [] เสมอ
};

const Ctx = createContext<AuthCtx | undefined>(undefined);
const BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8080";

const normalizeMe = (x: any): AuthUser => ({
  username: x?.username ?? "",
  roles: Array.isArray(x?.roles) ? x.roles : [],
  permissions: Array.isArray(x?.permissions) ? x.permissions
            : Array.isArray(x?.perms) ? x.perms : [],
  perms: Array.isArray(x?.perms) ? x.perms : undefined,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("access_token"));
  const [me, setMe] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(!!token);

  useEffect(() => {
    (async () => {
      if (!token) { setMe(null); setLoading(false); return; }
      try {
        const r = await fetch(`${BASE}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
        if (!r.ok) throw new Error("me failed");
        setMe(normalizeMe(await r.json()));
      } catch {
        setMe(null); setToken(null); localStorage.removeItem("access_token");
      } finally { setLoading(false); }
    })();
  }, [token]);

  const login = async (u: string, p: string) => {
    try {
      const r = await fetch(`${BASE}/api/auth/login`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u, password: p }),
      });
      if (!r.ok) return false;
      const data = await r.json();
      localStorage.setItem("access_token", data.access_token);
      setToken(data.access_token);
      setLoading(true);
      return true;
    } catch { return false; }
  };

  const logout = () => { localStorage.removeItem("access_token"); setToken(null); setMe(null); };

  const roles = me?.roles ?? [];
  const perms = me?.permissions ?? me?.perms ?? []; // ✅ ปลอดภัยเสมอ
  const isSuperadmin = roles.includes("superadmin");
  const can = (perm: string) => isSuperadmin || perms.includes(perm);

  const value: AuthCtx = useMemo(() => ({
    token, me, loading, login, logout, isSuperadmin, can, roles, perms
  }), [token, me, loading, isSuperadmin, perms, roles]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

