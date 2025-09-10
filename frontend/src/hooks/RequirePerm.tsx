// FILE: src/hooks/RequirePerm.tsx
import React, { ReactNode } from "react";
import { getPerms } from "@/lib/auth";

export default function RequirePerm({ need, children, showHint }: {
  need: string; children: ReactNode; showHint?: boolean
}) {
  const perms = getPerms();
  if (!perms.includes(need)) {
    return showHint ? <div className="text-sm text-muted-foreground">ต้องการสิทธิ์: {need}</div> : null;
  }
  return <>{children}</>;
}

