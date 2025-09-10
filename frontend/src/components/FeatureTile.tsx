import React from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils"; // ถ้าไม่มี util นี้ เปลี่ยนเป็นการต่อสตริงปกติได้

type Scheme = "sky" | "cyan" | "teal" | "emerald" | "violet" | "amber";

const schemes: Record<Scheme, { tile: string; halo: string; icon: string; ring: string }> = {
  sky:     { tile: "from-sky-50 to-sky-100 dark:from-sky-900/30 dark:to-sky-800/30",
             halo: "from-sky-200/70 via-sky-100/60 to-white/30 dark:from-sky-700/40 dark:to-transparent",
             icon: "text-sky-600 dark:text-sky-300", ring: "ring-sky-500/20" },
  cyan:    { tile: "from-cyan-50 to-cyan-100 dark:from-cyan-900/30 dark:to-cyan-800/30",
             halo: "from-cyan-200/70 via-cyan-100/60 to-white/30 dark:from-cyan-700/40 dark:to-transparent",
             icon: "text-cyan-600 dark:text-cyan-300", ring: "ring-cyan-500/20" },
  teal:    { tile: "from-teal-50 to-teal-100 dark:from-teal-900/30 dark:to-teal-800/30",
             halo: "from-teal-200/70 via-teal-100/60 to-white/30 dark:from-teal-700/40 dark:to-transparent",
             icon: "text-teal-600 dark:text-teal-300", ring: "ring-teal-500/20" },
  emerald: { tile: "from-emerald-50 to-emerald-100 dark:from-emerald-900/30 dark:to-emerald-800/30",
             halo: "from-emerald-200/70 via-emerald-100/60 to-white/30 dark:from-emerald-700/40 dark:to-transparent",
             icon: "text-emerald-600 dark:text-emerald-300", ring: "ring-emerald-500/20" },
  violet:  { tile: "from-violet-50 to-violet-100 dark:from-violet-900/30 dark:to-violet-800/30",
             halo: "from-violet-200/70 via-violet-100/60 to-white/30 dark:from-violet-700/40 dark:to-transparent",
             icon: "text-violet-600 dark:text-violet-300", ring: "ring-violet-500/20" },
  amber:   { tile: "from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-800/30",
             halo: "from-amber-200/70 via-amber-100/60 to-white/30 dark:from-amber-700/40 dark:to-transparent",
             icon: "text-amber-600 dark:text-amber-300", ring: "ring-amber-500/20" },
};

type Props = {
  to: string;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  scheme?: Scheme;
  disabled?: boolean;
};

export default function FeatureTile({ to, label, icon: Icon, scheme = "sky", disabled }: Props) {
  const s = schemes[scheme];
  const tile = (
    <div
      className={cn(
        "group relative rounded-3xl p-4 w-[148px] h-[148px] select-none",
        "bg-gradient-to-b shadow-[0_8px_24px_rgba(2,6,23,0.25)] ring-1",
        s.tile, s.ring,
        disabled && "opacity-60 pointer-events-none"
      )}
    >
      {/* soft halo */}
      <div className={cn(
        "absolute inset-0 rounded-3xl bg-gradient-to-br blur-xl opacity-60 pointer-events-none",
        s.halo
      )} />
      {/* icon bubble */}
      <div className="relative mx-auto mt-3 grid place-items-center w-16 h-16 rounded-2xl bg-white/80 dark:bg-white/5 ring-1 ring-white/40 dark:ring-white/10 shadow">
        <Icon className={cn("w-7 h-7", s.icon)} strokeWidth={1.6} />
      </div>
      {/* label */}
      <div className="relative mt-3 text-center text-[13px] font-medium text-foreground/90">
        {label}
      </div>
    </div>
  );
  return disabled ? tile : <Link to={to} aria-label={label}>{tile}</Link>;
}

