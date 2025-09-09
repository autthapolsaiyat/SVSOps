// ————————————————————————————————————————————————
// FILE: src/components/ProtectedRoute.tsx
//--------------------------------------------------
import React from "react";
import { Navigate } from "react-router-dom";


export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
const token = localStorage.getItem("access_token") || localStorage.getItem("token");
if (!token) return <Navigate to="/login" replace />;
return <>{children}</>;
}
