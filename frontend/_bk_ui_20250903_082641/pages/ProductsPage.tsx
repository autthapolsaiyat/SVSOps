// FILE: src/pages/ProductsPage.tsx
import React, { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Pencil, Plus, Trash2, Search, X } from "lucide-react";
import { toast } from "sonner";
import {
  listProducts, createProduct, updateProduct, deleteProduct,
  Product, ProductList, importProducts,
} from "@/lib/api.products";
import { getPerms, isSuperadmin } from "@/lib/auth";

const DEFAULT_TEAM_ID = import.meta.env.VITE_DEFAULT_TEAM_ID as string | undefined;

// ===== types (ขยายให้มี cas_no ฝั่ง UI ให้รับ null ได้) =====
type ProductEx = Product & { cas_no?: string | null };

type FormState = {
  sku: string;
  name: string;
  cas_no?: string;
  unit: string;
  price_ex_vat: string;
  team_id?: string;
};

// ---------- RBAC helpers ----------
function rolesFromToken(): string[] {
  try {
    const t = localStorage.getItem("access_token") || "";
    const b = t.split(".")[1];
    if (!b) return [];
    const s = atob(b.replace(/-/g, "+").replace(/_/g, "/"));
    const p = JSON.parse(s);
    return Array.isArray(p.roles) ? p.roles : [];
  } catch {
    return [];
  }
}
function isSysopName(): boolean {
  try {
    const u = JSON.parse(localStorage.getItem("auth_user") || "{}");
    return typeof u?.username === "string" && u.username.toLowerCase() === "sysop";
  } catch {
    return false;
  }
}
// ----------------------------------

export default function ProductsPage() {
  // table state
  const [items, setItems] = useState<ProductEx[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [sort, setSort] = useState<"sku" | "name" | "unit" | "price_ex_vat">("sku");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // dialogs
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState<null | ProductEx>(null);

  // Import dialog
  const [showImport, setShowImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<"upsert" | "replace">("upsert");
  const [importTeam, setImportTeam] = useState<string>(DEFAULT_TEAM_ID || "");

  // search debounce
  const [qDebounced, setQDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 400);
    return () => clearTimeout(t);
  }, [q]);

  // RBAC combine
  const perms = getPerms();
  const superByRole =
    isSuperadmin() ||
    rolesFromToken().some((r) => r === "sysop" || r === "superadmin") ||
    isSysopName();

  const canCreate = superByRole || perms.includes("products:create");
  const canUpdate = superByRole || perms.includes("products:update");
  const canDelete = superByRole || perms.includes("products:delete");
  const canImport = superByRole || canCreate || perms.includes("products:update") || perms.includes("products:import");

  function showLoadError(err: any) {
    const msg: string =
      typeof err?.message === "string" && err.message.startsWith("403")
        ? "คุณไม่มีสิทธิ์ดูสินค้า (products:read)"
        : err?.response?.data?.detail || err?.message || "โหลดข้อมูลไม่สำเร็จ";
    setErrMsg(msg);
    toast.error(msg);
  }

  async function load() {
    setLoading(true);
    try {
      // debug ช่วยไล่ URL
      if (localStorage.DEBUG_API === "1") {
        const qs = new URLSearchParams({
          ...(qDebounced ? { q: qDebounced } : {}),
          page: String(page), per_page: String(perPage), sort, order,
        }).toString();
        console.debug("[Products] → GET /api/products?" + qs);
      }

      const data: ProductList = await listProducts({
        q: qDebounced || undefined,
        page,
        per_page: perPage,
        sort,
        order,
      });
      setItems((Array.isArray(data.items) ? data.items : []) as ProductEx[]);
      setTotal(Number(data.total ?? 0));
      setPages(Number((data as any).pages ?? 1));
      setErrMsg(null);
    } catch (err) {
      console.error("[Products] load error:", err);
      setItems([]);
      setTotal(0);
      setPages(1);
      showLoadError(err);
    } finally {
      setLoading(false);
    }
  }

  // ✅ บังคับโหลดครั้งแรกทันทีตอน mount
  useEffect(() => {
    if (localStorage.DEBUG_ROUTE === "1") console.info("[Products] mount: load()");
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qDebounced, page, perPage, sort, order]);

  function changeSort(col: "sku" | "name" | "unit" | "price_ex_vat") {
    if (col === sort) setOrder(order === "asc" ? "desc" : "asc");
    else {
      setSort(col);
      setOrder("asc");
    }
    setPage(1);
  }

  async function onDelete(id: string) {
    if (!(superByRole || canDelete)) return toast.error("Forbidden");
    const oldItems = items;
    const oldTotal = total;
    setItems((prev) => prev.filter((x) => x.id !== id));
    setTotal((t) => Math.max(0, t - 1));
    try {
      await deleteProduct(id);
      toast.success("ลบแล้ว");
      if (oldItems.length === 1 && page > 1) setPage((p) => p - 1);
    } catch (e: any) {
      setItems(oldItems);
      setTotal(oldTotal);
      toast.error(e?.response?.data?.detail ?? "ลบไม่สำเร็จ");
    }
  }

  const from = total ? (page - 1) * perPage + 1 : 0;
  const to = Math.min(page * perPage, total);

  return (
    <div className="p-6 space-y-4">
      <section className="rounded-2xl border border-panel bg-panel shadow-none p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-semibold">สินค้า</h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 opacity-60" />
              <Input
                className="pl-8 pr-8 w-64 bg-panel-soft"
                placeholder="ค้นหา SKU / ชื่อ / CAS / หน่วย"
                value={q}
                onChange={(e) => { setQ(e.target.value); setPage(1); }}
                onKeyDown={(e) => { if (e.key === "Enter") setPage(1); }}
              />
              {!!q && (
                <button
                  type="button"
                  aria-label="ล้างคำค้นหา"
                  className="absolute right-2 top-1/2 -translate-y-1/2 opacity-70 hover:opacity-100"
                  onClick={() => { setQ(""); setPage(1); }}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <select
              className="border rounded-md px-2 py-1 text-sm bg-transparent"
              value={perPage}
              onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
            >
              {[10, 20, 50].map((n) => (
                <option key={n} value={n}>{n}/หน้า</option>
              ))}
            </select>
          </div>
        </div>

        {errMsg && (
          <div className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600">
            {errMsg}
          </div>
        )}

        <div className="mt-2 text-sm opacity-70">
          {loading ? "กำลังค้นหา..." : q ? `ผลลัพธ์สำหรับ “${q}”` : "ทั้งหมด"}
        </div>

        <div className="mt-3">
          {loading ? (
            <p>กำลังโหลด...</p>
          ) : (
            <>
              <Table className="bg-transparent">
                <TableHeader>
                  <TableRow className="bg-transparent">
                    <TableHead onClick={() => changeSort("sku")} className="cursor-pointer select-none">
                      SKU{sort === "sku" ? (order === "asc" ? " ▲" : " ▼") : ""}
                    </TableHead>
                    <TableHead onClick={() => changeSort("name")} className="cursor-pointer select-none">
                      ชื่อ{sort === "name" ? (order === "asc" ? " ▲" : " ▼") : ""}
                    </TableHead>
                    <TableHead>CAS No.</TableHead>
                    <TableHead onClick={() => changeSort("unit")} className="cursor-pointer select-none">
                      หน่วย{sort === "unit" ? (order === "asc" ? " ▲" : " ▼") : ""}
                    </TableHead>
                    <TableHead onClick={() => changeSort("price_ex_vat")} className="cursor-pointer select-none text-right">
                      ราคา (ก่อน VAT){sort === "price_ex_vat" ? (order === "asc" ? " ▲" : " ▼") : ""}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((p) => (
                    <TableRow key={p.id} className="bg-panel-soft">
                      <TableCell className="font-mono">{p.sku}</TableCell>
                      <TableCell>{p.name}</TableCell>
                      <TableCell>{(p as any).cas_no || "-"}</TableCell>
                      <TableCell>{p.unit}</TableCell>
                      <TableCell className="text-right">
                        {Number((p as any).price_ex_vat ?? (p as any).price ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!loading && items.length === 0 && (
                    <TableRow className="bg-transparent">
                      <TableCell colSpan={5} className="text-center py-8 opacity-70">ไม่พบข้อมูล</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              <div className="mt-4 flex items-center justify-between text-sm">
                <div>แสดง {from}–{to} จาก {total} รายการ</div>
                <div className="space-x-2">
                  <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>ก่อนหน้า</Button>
                  <span className="px-2">หน้า {page}/{Math.max(pages, 1)}</span>
                  <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>ถัดไป</Button>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {/* … โค้ด Import / Create / Edit เดิมของคุณคงไว้เหมือนเดิม … */}
      {/* (ตัดออกเพื่อย่อ แต่คุณสามารถวางทับทั้งไฟล์นี้ หรือคัดเอาเฉพาะส่วน useEffect/load ไปใส่ไฟล์เดิม) */}
    </div>
  );
}

