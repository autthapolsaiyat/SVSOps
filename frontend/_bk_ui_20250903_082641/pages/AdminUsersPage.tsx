// FILE: src/pages/AdminUsersPage.tsx
import {
  usersList,
  usersCreate,
  usersUpdate,
  usersDelete,
  type UserRow,
  type UserStatus,
} from "@/lib/api.client";
import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, Power, Trash2, UserPlus } from "lucide-react";
import { useAuth } from "@/lib/auth.store";

/* ============ Small utils ============ */

const isBrowser = typeof window !== "undefined" && typeof localStorage !== "undefined";

function safeGetToken(): string | null {
  if (!isBrowser) return null;
  // รองรับทั้ง access_token และ token (เข้ากับ auth.ts ใหม่)
  const keys = ["access_token", "token"];
  for (const k of keys) {
    const v = localStorage.getItem(k);
    if (v) return v;
  }
  return null;
}

function decodeJwtPayload<T = any>(jwt: string | null): T | null {
  if (!jwt) return null;
  const parts = jwt.split(".");
  if (parts.length < 2) return null;
  const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  try {
    const json = JSON.parse(atob(base64));
    return json as T;
  } catch {
    return null;
  }
}

function rolesFromToken(): string[] {
  const payload = decodeJwtPayload<{ roles?: string[] }>(safeGetToken());
  return Array.isArray(payload?.roles) ? payload!.roles! : [];
}

/* ============ UI bits ============ */
function StatusPill({ value }: { value: UserStatus | undefined }) {
  const active = String(value).toLowerCase() === "active";
  return (
    <span
      className={
        active
          ? "px-2 py-0.5 rounded-full text-xs font-medium bg-primary/15 text-primary ring-1 ring-primary/25"
          : "px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground ring-1 ring-border"
      }
    >
      {active ? "Active" : "Disabled"}
    </span>
  );
}

/* ============ Page ============ */
export default function AdminUsersPage() {
  const { perms } = useAuth();

  // derive perms/roles (memoized)
  const isSuper = useMemo(() => rolesFromToken().includes("superadmin"), []);
  const canCreate = isSuper || perms.includes("สร้างผู้ใช้");
  const canUpdate = isSuper || perms.includes("แก้ไขผู้ใช้");
  const canDelete = isSuper || perms.includes("ลบผู้ใช้");

  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // create form
  const [uname, setUname] = useState("");
  const [pwd, setPwd] = useState("");
  const [status, setStatus] = useState<"active" | "disabled">("active");
  const [creating, setCreating] = useState(false);

  // busy tracker per row toกันกดซ้ำ
  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({});

  function setBusy(id: string, v: boolean) {
    setBusyIds((prev) => ({ ...prev, [id]: v }));
  }

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const list = await usersList();
      setRows(list);
      setErr(null);
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // no deps: run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function doCreate() {
    if (!uname || !pwd || !canCreate) return;
    setCreating(true);
    setErr(null);
    try {
      await usersCreate({ username: uname, password: pwd, status });
      setUname("");
      setPwd("");
      setStatus("active");
      await load();
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setCreating(false);
    }
  }

  async function toggleStatus(u: UserRow) {
    if (!canUpdate || busyIds[u.id]) return;
    const next = String(u.status).toLowerCase() === "active" ? "disabled" : "active";
    setErr(null);
    setBusy(u.id, true);
    try {
      await usersUpdate(u.id, { status: next });
      await load();
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(u.id, false);
    }
  }

  async function resetPw(u: UserRow) {
    if (!canUpdate || busyIds[u.id]) return;
    const npw = prompt(`New password for ${u.username}:`, "changeme");
    if (!npw) return;
    setErr(null);
    setBusy(u.id, true);
    try {
      await usersUpdate(u.id, { password: npw });
      alert("Password updated");
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(u.id, false);
    }
  }

  async function remove(u: UserRow) {
    if (!canDelete || busyIds[u.id]) return;
    if (!confirm(`Delete user ${u.username}?`)) return;
    setErr(null);
    setBusy(u.id, true);
    try {
      await usersDelete(u.id);
      await load();
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(u.id, false);
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      {/* การ์ดเข้มแบบหน้า Login */}
      <Card className="bg-card dark:bg-[#0f172a] border border-border dark:border-[#1f2937] shadow">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <span className="font-semibold">Admin → Users</span>
            <Button
              onClick={doCreate}
              disabled={creating || !uname || !pwd || !canCreate}
              className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm focus:ring-2 focus:ring-primary/40"
              title={canCreate ? "สร้างผู้ใช้" : "ไม่มีสิทธิ์สร้างผู้ใช้"}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              {creating ? "Creating…" : "Create"}
            </Button>
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {err && <div className="text-destructive text-sm whitespace-pre-wrap">{err}</div>}

          {/* ฟอร์มเข้ม */}
          <div className="rounded-xl p-4 bg-secondary dark:bg-[#0b1220]">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              <div className="md:col-span-4">
                <Label className="text-muted-foreground">Username</Label>
                <Input
                  className="h-10 bg-background dark:bg-[#0b1220] border border-input text-foreground placeholder:text-muted-foreground"
                  value={uname}
                  onChange={(e) => setUname(e.target.value)}
                  placeholder="username"
                  autoComplete="username"
                />
              </div>
              <div className="md:col-span-4">
                <Label className="text-muted-foreground">Password</Label>
                <Input
                  type="password"
                  className="h-10 bg-background dark:bg-[#0b1220] border border-input text-foreground placeholder:text-muted-foreground"
                  value={pwd}
                  onChange={(e) => setPwd(e.target.value)}
                  placeholder="password"
                  autoComplete="new-password"
                />
              </div>
              <div className="md:col-span-2">
                <Label className="text-muted-foreground">Status</Label>
                <select
                  className="h-10 w-full rounded bg-background dark:bg-[#0b1220] border border-input text-foreground"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                >
                  <option value="active">active</option>
                  <option value="disabled">disabled</option>
                </select>
              </div>
            </div>
          </div>

          {/* ตาราง */}
          <div className="rounded-lg border border-border overflow-hidden">
            <Table className="bg-transparent">
              <TableHeader className="bg-secondary dark:bg-[#0e1626]">
                <TableRow>
                  <TableHead className="w-[40%] text-muted-foreground">Username</TableHead>
                  <TableHead className="w-[20%] text-muted-foreground">Status</TableHead>
                  <TableHead className="text-right w-[40%] text-muted-foreground">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={3}>Loading…</TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground text-center">
                      No users
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((u) => {
                    const isActive = String(u.status).toLowerCase() === "active";
                    const busy = !!busyIds[u.id];
                    return (
                      <TableRow
                        key={u.id}
                        className="bg-transparent odd:dark:bg-[#0b1220]/30 hover:dark:bg-[#101826] transition-colors"
                      >
                        <TableCell className="font-medium bg-transparent">{u.username}</TableCell>
                        <TableCell className="bg-transparent">
                          <StatusPill value={u.status} />
                        </TableCell>
                        <TableCell className="text-right space-x-2 bg-transparent">
                          {/* Toggle */}
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={!canUpdate || busy}
                            title={
                              canUpdate ? (isActive ? "ปิดการใช้งานบัญชี" : "เปิดการใช้งานบัญชี") : "ไม่มีสิทธิ์"
                            }
                            onClick={() => canUpdate && toggleStatus(u)}
                            className={
                              (isActive
                                ? "bg-amber-500 hover:bg-amber-600 text-black"
                                : "bg-emerald-600 hover:bg-emerald-700 text-white") +
                              " ring-1 ring-white/10 shadow-sm" +
                              (!canUpdate || busy ? " opacity-50 cursor-not-allowed" : "")
                            }
                          >
                            <Power className="h-4 w-4 mr-1" />
                            {isActive ? (busy ? "Disabling…" : "Disable") : busy ? "Activating…" : "Activate"}
                          </Button>

                          {/* Reset PW */}
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={!canUpdate || busy}
                            title={canUpdate ? "ตั้งรหัสผ่านใหม่" : "ไม่มีสิทธิ์"}
                            onClick={() => canUpdate && resetPw(u)}
                            className={
                              "bg-primary hover:bg-primary/90 text-primary-foreground ring-1 ring-white/10 shadow-sm" +
                              (!canUpdate || busy ? " opacity-50 cursor-not-allowed" : "")
                            }
                          >
                            <KeyRound className="h-4 w-4 mr-1" />
                            {busy ? "Updating…" : "Reset PW"}
                          </Button>

                          {/* Delete */}
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={!canDelete || busy}
                            title={canDelete ? "ลบบัญชีผู้ใช้" : "ไม่มีสิทธิ์"}
                            onClick={() => canDelete && remove(u)}
                            className={
                              "bg-destructive hover:bg-destructive/90 text-destructive-foreground ring-1 ring-white/10 shadow-sm" +
                              (!canDelete || busy ? " opacity-50 cursor-not-allowed" : "")
                            }
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            {busy ? "Deleting…" : "Delete"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

