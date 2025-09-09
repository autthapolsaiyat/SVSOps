// FILE: src/lib/theme.ts
export type ThemeMode = "light" | "dark";
const KEY = "theme";

export function getTheme(): ThemeMode {
  const v = localStorage.getItem(KEY);
  return v === "light" || v === "dark" ? v : "dark"; // default: dark
}

export function getAppliedTheme(): ThemeMode {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  // ใช้ class strategy (Tailwind/shadcn)
  root.classList.toggle("dark", mode === "dark");
  // ให้ browser ปรับ native controls ด้วย
  root.style.colorScheme = mode;
  // เผื่อ framework อื่นใช้งาน
  root.setAttribute("data-theme", mode);
  localStorage.setItem(KEY, mode);
}

export function toggleTheme(): ThemeMode {
  const next: ThemeMode = getAppliedTheme() === "dark" ? "light" : "dark";
  applyTheme(next);
  return next;
}

/** เรียกก่อน render เพื่อกันแฟลชธีม */
export function initTheme() {
  applyTheme(getTheme());
}

