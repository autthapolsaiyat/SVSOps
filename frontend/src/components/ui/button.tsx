import * as React from "react";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline";
};

export function Button({ className = "", variant = "default", ...props }: Props) {
  const base =
    "inline-flex items-center justify-center rounded px-3 py-2 text-sm " +
    "transition outline-none focus:ring focus:ring-sky-600/30 disabled:opacity-50";
  const look =
    variant === "outline"
      ? "border border-zinc-700 bg-transparent text-zinc-100 hover:bg-zinc-800"
      : "bg-sky-600 text-white hover:bg-sky-500";
  return <button className={`${base} ${look} ${className}`} {...props} />;
}

