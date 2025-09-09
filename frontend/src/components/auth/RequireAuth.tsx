// src/components/auth/RequireAuth.tsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { state } = useAuth();
  const loc = useLocation();
  if (state.status === "loading") return null;            // หรือใส่ spinner
  if (state.status === "unauthenticated") return <Navigate to="/login" replace state={{ from: loc }} />;
  return <>{children}</>;
}

export function RequirePerm({ perms, children }: { perms: string[]; children: React.ReactNode }) {
  const { state, hasPerm } = useAuth();
  if (state.status !== "authenticated") return null;
  return hasPerm(...perms) ? <>{children}</> : <div className="p-4 text-sm text-red-400">ไม่มีสิทธิ์เข้าถึง</div>;
}

