import React from "react";
import { useAuth } from "@/contexts/AuthContext";

export default function LogoutButton() {
  const { state, logout } = useAuth();
  if (state.status !== "authenticated") return null;
  return (
    <button
      onClick={logout}
      className="text-xs px-2 py-1 rounded border border-zinc-600 hover:bg-zinc-800"
      title={`Logout ${state.user.username}`}
    >
      Logout
    </button>
  );
}

