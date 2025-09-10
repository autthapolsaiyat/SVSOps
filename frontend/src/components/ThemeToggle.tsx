// FILE: src/components/ThemeToggle.tsx
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sun, Moon } from "lucide-react";
import { getTheme, getAppliedTheme, toggleTheme, applyTheme } from "@/lib/theme";

export default function ThemeToggle() {
  // แสดงสถานะ "ที่ใช้อยู่จริง" บน <html>
  const [mode, setMode] = useState<"light" | "dark">(getAppliedTheme());

  // sync กรณีเปลี่ยนธีมจากแท็บอื่น
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "theme") {
        const v = getTheme();
        applyTheme(v);
        setMode(v);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // บางครั้งแอพอื่นไปแตะ class ที่ <html> ให้ตรวจทุกครั้งที่โฟกัสกลับมา
  useEffect(() => {
    const onFocus = () => setMode(getAppliedTheme());
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const isDark = mode === "dark";
  const nextMode = isDark ? "light" : "dark";

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setMode(toggleTheme())}
      aria-pressed={isDark}
      title={`Switch to ${nextMode} theme`}
      className="gap-2"
    >
      {isDark ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
      <span className="hidden sm:inline">{isDark ? "Dark" : "Light"}</span>
    </Button>
  );
}

