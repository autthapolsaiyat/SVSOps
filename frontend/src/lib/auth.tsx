import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { StockAPI } from './apiStock';

type User = { username: string; role?: string } | null;

type AuthCtx = {
  token: string | null;
  user: User;
  setToken: (t: string | null) => void;
  reloadUser: () => Promise<void>;
  logout: () => void;
};

const Ctx = createContext<AuthCtx>(null as any);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [user, setUser] = useState<User>(null);

  useEffect(() => {
    if (token) StockAPI.me().then(setUser).catch(() => setUser(null));
    else setUser(null);
  }, [token]);

  const value = useMemo<AuthCtx>(() => ({
    token,
    user,
    setToken: (t) => { 
      if (t) localStorage.setItem('token', t); else localStorage.removeItem('token');
      setToken(t);
    },
    reloadUser: async () => {
      if (!localStorage.getItem('token')) { setUser(null); return; }
      try { setUser(await StockAPI.me()); } catch { setUser(null); }
    },
    logout: () => { localStorage.removeItem('token'); setToken(null); setUser(null); },
  }), [token, user]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);

