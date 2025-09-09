// src/lib/theme.store.ts
import { create } from "zustand";

type ThemeState = { dark: boolean; toggle: () => void; set: (v: boolean) => void };

function preferDark(): boolean {
  try {
    const saved = localStorage.getItem("theme:dark");
    if (saved === "1") return true;
    if (saved === "0") return false;
  } catch {}
  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? true;
}

function apply(dark: boolean) {
  const root = document.documentElement;     // <html>
  root.classList.toggle("dark", dark);
  try { localStorage.setItem("theme:dark", dark ? "1" : "0"); } catch {}
}

export const useTheme = create<ThemeState>((set, get) => ({
  dark: preferDark(),
  toggle: () => { const v = !get().dark; apply(v); set({ dark: v }); },
  set: (v) => { apply(v); set({ dark: v }); },
}));

// sync ครั้งแรก
apply(preferDark());

