import React from "react";
import { useAuth } from "@/lib/auth.store";

export default function RequirePerm({ perm, children }: { perm: string; children: React.ReactNode }) {
  const { token, perms, } = useAuth();
  // รอให้ hydrate เสร็จ: ถ้า token ยังไม่มี อาจให้แสดง Loading ก็ได้
  const isSuperadmin = Array.isArray(perms) && perms.includes("superadmin"); // เผื่อคุณเก็บ role ใน perms ด้วย
  const ok = isSuperadmin || (Array.isArray(perms) && perms.includes(perm));
  if (!token) return <div className="p-6">Loading…</div>;
  if (!ok) return <div className="p-6 text-red-600">Forbidden</div>;
  return <>{children}</>;
}

