// src/lib/auth.ts
export type AuthUser = {
  id: string;
  username: string;
  email: string;
  roles: string[];
  permissions: string[];
};

const TOKEN_KEY = "token";

const ensureApiPath = (p: string) => (p.startsWith("/api") ? p : `/api${p.startsWith("/") ? p : `/${p}`}`);

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY) || "";
  const res = await fetch(ensureApiPath(path), {
    ...init,
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
    credentials: "include",
  });
  const txt = await res.text();
  if (!res.ok) {
    let msg = res.statusText;
    try { msg = JSON.parse(txt)?.detail ?? JSON.parse(txt)?.message ?? msg; } catch {}
    throw new Error(`HTTP ${res.status}: ${msg}`);
  }
  return txt ? (JSON.parse(txt) as T) : (undefined as unknown as T);
}

export async function login(username: string, password: string): Promise<string> {
  const r = await http<{ access_token: string; token_type: "bearer" }>("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  localStorage.setItem(TOKEN_KEY, r.access_token);
  return r.access_token;
}

export async function me(): Promise<AuthUser> {
  return http<AuthUser>("/auth/me");
}

export async function logout(): Promise<void> {
  try { await http("/auth/logout", { method: "POST" }); } catch { /* ignore */ }
  localStorage.removeItem(TOKEN_KEY);
}

export function getToken(): string | null { return localStorage.getItem(TOKEN_KEY); }
export function setToken(tok: string) { localStorage.setItem(TOKEN_KEY, tok); }

