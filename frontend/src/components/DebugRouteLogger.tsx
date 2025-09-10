// FILE: src/components/DebugRouteLogger.tsx
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export default function DebugRouteLogger() {
  const { pathname, search } = useLocation();
  useEffect(() => {
    if (localStorage.getItem("DEBUG_ROUTE") === "1") {
      console.info("[ROUTE]", pathname + search);
    }
  }, [pathname, search]);
  return null;
}

