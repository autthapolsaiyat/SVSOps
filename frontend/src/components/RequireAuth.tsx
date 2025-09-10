// FILE: src/components/RequireAuth.tsx
import React, { ReactNode } from "react";
import { getToken, onAuth401, listenAuth401 } from "@/lib/auth";

export default function RequireAuth({ children }: { children: ReactNode }) {
  // ถ้าจำเป็นจะเพิ่ม logic ฟัง 401 ก็ได้
  // listenAuth401(() => { /* redirect to login */ });
  const t = getToken();
  if (!t) return <div className="p-6">กรุณาเข้าสู่ระบบ</div>;
  return <>{children}</>;
}

