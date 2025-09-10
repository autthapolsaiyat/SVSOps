import * as React from "react";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className = "", ...props }, ref) => (
    <input
      ref={ref}
      className={
        "w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 outline-none " +
        "focus:ring focus:ring-sky-600/30 " + className
      }
      {...props}
    />
  )
);
Input.displayName = "Input";

