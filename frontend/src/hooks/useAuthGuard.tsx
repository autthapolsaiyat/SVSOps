// FILE: src/hooks/useAuthGuard.tsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth.store";

// เช็ค token จาก localStorage เผื่อ store ยังไม่ hydrate
function hasTokenLocal() {
  return !!(localStorage.getItem("access_token") || localStorage.getItem("token"));
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { token, hydrated, hydrate } = useAuth();
  const loc = useLocation();

  // ให้ hydrate หนึ่งครั้งถ้ายังไม่ทำ
  React.useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  // ถ้าไม่มี token ทั้งใน store และ local → เด้งไป login ทันที (ไม่ค้าง)
  if (!token && !hasTokenLocal()) {
    return <Navigate to="/login" state={{ from: loc }} replace />;
  }

  // ถ้ายังไม่ hydrated และมี token ใน local → แสดง loading สั้น ๆ ระหว่าง hydrate
  if (!hydrated) {
    return <div className="p-6">Loading…</div>;
  }

  return <>{children}</>;
}

