// FILE: src/lib/api.auth.ts (ใหม่)
import api from "./api.client";

export type LoginResp = {
  access_token: string;
  token_type: "bearer";
  expires_in: number;
  roles: string[];
  perms: string[];
  user: { id: string; username: string };
};

export async function login(username: string, password: string) {
  const { access_token, user, perms } = await api.post<LoginResp>("/auth/login", { username, password });
  localStorage.setItem("access_token", access_token);
  localStorage.setItem("auth_user", JSON.stringify(user));
  localStorage.setItem("auth_perms", JSON.stringify(perms));
  // เผื่อมีหน้าที่ฟังอีเวนต์นี้อยู่
  window.dispatchEvent(new CustomEvent("auth:login"));
  return { access_token, user, perms };
}

