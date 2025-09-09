// src/contexts/AuthContext.tsx
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { login as apiLogin, me as apiMe, logout as apiLogout, getToken, setToken } from "@/lib/auth";

export type AuthState =
  | { status: "loading"; user: null }
  | { status: "authenticated"; user: import("@/lib/auth").AuthUser }
  | { status: "unauthenticated"; user: null };

type Ctx = {
  state: AuthState;
  login: (u: string, p: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPerm: (...perms: string[]) => boolean;
};

const AuthContext = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading", user: null });

  const fetchMe = useCallback(async () => {
    try {
      if (!getToken()) { setState({ status: "unauthenticated", user: null }); return; }
      const u = await apiMe();
      setState({ status: "authenticated", user: u });
    } catch {
      setState({ status: "unauthenticated", user: null });
    }
  }, []);

  useEffect(() => { fetchMe(); }, [fetchMe]);

  const doLogin = useCallback(async (username: string, password: string) => {
    await apiLogin(username, password);
    await fetchMe();
  }, [fetchMe]);

  const doLogout = useCallback(async () => {
    await apiLogout();
    setState({ status: "unauthenticated", user: null });
  }, []);

  const hasPerm = useCallback((...perms: string[]) => {
    if (state.status !== "authenticated") return false;
    const P = new Set(state.user.permissions || []);
    if (P.has("*")) return true;
    return perms.some(p => P.has(p));
  }, [state]);

  const value = useMemo<Ctx>(() => ({ state, login: doLogin, logout: doLogout, hasPerm }), [state, doLogin, doLogout, hasPerm]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

