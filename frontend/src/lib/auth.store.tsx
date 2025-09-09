// FILE: src/lib/auth.store.ts
import { create } from "zustand";

type AuthUser = { id: string; username: string; email?: string; roles?: string[] };

const TOKEN_KEYS = ["access_token", "token"];
const USER_KEY = "auth_user";
const PERMS_KEY = "auth_perms";

function readToken(): string | null {
  for (const k of TOKEN_KEYS) {
    const v = localStorage.getItem(k);
    if (v) return v;
  }
  return null;
}
function writeToken(t: string) {
  for (const k of TOKEN_KEYS) localStorage.setItem(k, t);
}
function clearStorage() {
  for (const k of TOKEN_KEYS) localStorage.removeItem(k);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(PERMS_KEY);
}
function readUser(): AuthUser | null {
  try { const raw = localStorage.getItem(USER_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function readPerms(): string[] {
  try { const raw = localStorage.getItem(PERMS_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
}

type AuthState = {
  token: string | null;
  user: AuthUser | null;
  perms: string[];
  hydrated: boolean;
  hydrate: () => void;
  setAuth: (token: string, user: AuthUser, perms: string[]) => void;
  logout: () => void;
};

export const useAuth = create<AuthState>((set) => ({
  token: null,
  user: null,
  perms: [],
  hydrated: false,
  hydrate: () => {
    const token = readToken();
    const user = readUser();
    const perms = readPerms();
    set({ token, user, perms, hydrated: true });
  },
  setAuth: (token, user, perms) => {
    writeToken(token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    localStorage.setItem(PERMS_KEY, JSON.stringify(perms || []));
    set({ token, user, perms, hydrated: true });
  },
  logout: () => {
    clearStorage();
    set({ token: null, user: null, perms: [], hydrated: true });
  },
}));

// helpers เผื่อที่อื่นเรียกตรง
export const AuthStorage = { readToken, readUser, readPerms, clearStorage };

