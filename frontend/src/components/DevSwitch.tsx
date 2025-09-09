// FILE: src/components/DevSwitch.tsx
import React, { useEffect, useState } from "react";

function getOn() {
  return localStorage.getItem("DEBUG_ROUTE") === "1" || localStorage.getItem("DEBUG_API") === "1";
}
export default function DevSwitch() {
  const [on, setOn] = useState(getOn());
  useEffect(() => {
    const h = () => setOn(getOn());
    window.addEventListener("storage", h);
    return () => window.removeEventListener("storage", h);
  }, []);
  const toggle = () => {
    if (on) {
      localStorage.removeItem("DEBUG_ROUTE");
      localStorage.removeItem("DEBUG_API");
    } else {
      localStorage.DEBUG_ROUTE = "1";
      localStorage.DEBUG_API = "1";
    }
    setOn(!on);
    location.reload();
  };
  const host = typeof window !== "undefined" ? window.location.host : "";
  return (
    <button
      onClick={toggle}
      title={on ? `Debug ON @ ${host}` : `Debug OFF @ ${host}`}
      className={`px-2 py-1 rounded-md text-xs border ml-2 ${on ? "bg-green-600 text-white" : "bg-transparent border-border text-muted-foreground hover:bg-accent"}`}
      style={{fontFamily:"monospace"}}
    >
      🐞 {on ? "DEBUG:ON" : "DEBUG:OFF"}
    </button>
  );
}
