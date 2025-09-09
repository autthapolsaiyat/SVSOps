// FILE: src/lib/perm.ts
import { getPerms } from "@/lib/auth";

export function hasPerm(p: string) {
  const perms = getPerms();
  return perms.includes(p);
}

