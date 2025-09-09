// FILE: src/pages/ProductFormPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  upsertProduct,
  getProductBySku,
  listTeams,
  listGroups,
  type TeamItem,
  type GroupItem,
} from "@/lib/api.products";

type FormT = {
  sku: string;
  name: string;
  unit: string;
  team_code?: string;
  group_code?: string;
  group_name?: string;
  is_domestic?: boolean;
  group_tag?: string;
};

export default function ProductFormPage() {
  const nav = useNavigate();
  const params = useParams<{ sku?: string }>();
  const [sp] = useSearchParams();
  const editSku = params.sku || sp.get("sku") || "";

  const [form, setForm] = useState<FormT>({
    sku: "",
    name: "",
    unit: "EA",
    team_code: "STD",
    group_code: "",
    group_name: "",
    is_domestic: true,
    group_tag: "",
  });
  const [busy, setBusy] = useState(false);

  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [groups, setGroups] = useState<GroupItem[]>([]);

  useEffect(() => {
    (async () => {
      try { const t = await listTeams(); setTeams(t.items || []); } catch {}
      try { const g = await listGroups(); setGroups(g.items || []); } catch {}
    })();
  }, []);

  // เติมจาก URL ถ้ามี (ช่วย prefill)
  useEffect(() => {
    const patch: Partial<FormT> = {};
    const name = sp.get("name"); if (name) patch.name = name;
    const tc = sp.get("team_code"); if (tc) patch.team_code = tc;
    const gc = sp.get("group_code"); if (gc) patch.group_code = gc;
    const gn = sp.get("group_name"); if (gn) patch.group_name = gn;
    if (Object.keys(patch).length) setForm(f => ({ ...f, ...patch }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // โหลดจาก API เมื่ออยู่โหมดแก้ไข
  useEffect(() => {
    (async () => {
      if (!editSku) return;
      try {
        setBusy(true);
        const res = await getProductBySku(editSku);
        const item: any = (res as any)?.item ?? res;
        if (item) {
          setForm(f => ({
            ...f,
            sku: item.sku ?? editSku,
            name: item.name ?? f.name,
            unit: item.unit ?? f.unit,
            team_code: item.team_code ?? f.team_code,
            group_code: item.group_code ?? f.group_code,
            group_name: item.group_name ?? f.group_name,
            is_domestic: typeof item.is_domestic === "boolean" ? item.is_domestic : f.is_domestic,
            group_tag: item.group_tag ?? f.group_tag,
          }));
        } else {
          toast.error("ไม่พบสินค้า");
        }
      } catch (e: any) {
        toast.error(e?.message ?? "โหลดข้อมูลไม่สำเร็จ");
      } finally {
        setBusy(false);
      }
    })();
  }, [editSku]);

  // แผนที่ code -> name ของกลุ่ม
  const groupNameByCode = useMemo(() => {
    const m = new Map<string, string>();
    groups.forEach(g => { if (g.code) m.set(g.code, g.name || ""); });
    return m;
  }, [groups]);

  // ถ้าผู้ใช้เลือก group_code และยังไม่ได้ตั้ง group_name เอง ให้เติมให้อัตโนมัติ
  useEffect(() => {
    if (form.group_code && !form.group_name) {
      const auto = groupNameByCode.get(form.group_code);
      if (auto) setForm(f => ({ ...f, group_name: auto }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.group_code, groupNameByCode]);

  const set = (k: keyof FormT) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  async function save() {
    const sku = form.sku.trim();
    const name = form.name.trim();
    const unit = form.unit.trim();

    if (!sku || !name || !unit) {
      return toast.error("กรอก SKU / ชื่อ / หน่วย ให้ครบ");
    }

    setBusy(true);
    try {
      await upsertProduct({
        sku,
        name,
        unit,
        price: 0,
        team_code: form.team_code || undefined,
        group_code: form.group_code || undefined,
        group_name: (form.group_name || "").trim() || undefined,
        is_domestic: typeof form.is_domestic === "boolean" ? form.is_domestic : undefined,
        group_tag: (form.group_tag || "").trim() || undefined,
      });
      toast.success("บันทึกสินค้าเรียบร้อย");
      nav("/products", { replace: true });
    } catch (e: any) {
      toast.error(e?.message ?? "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-6">
      <section className="app-section overflow-visible max-w-2xl">
        <h2 className="text-lg font-semibold mb-4">
          {editSku ? "แก้ไขสินค้า" : "ป้อนสินค้าใหม่"}
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-sm opacity-70">SKU</label>
            <Input value={form.sku} onChange={set("sku")} disabled={!!editSku} />
          </div>
          <div>
            <label className="text-sm opacity-70">หน่วย (Unit)</label>
            <Input value={form.unit} onChange={set("unit")} placeholder="EA" />
          </div>

        <div className="sm:col-span-2">
            <label className="text-sm opacity-70">ชื่อสินค้า</label>
            <Input value={form.name} onChange={set("name")} />
          </div>

          <div>
            <label className="text-sm opacity-70">team_code</label>
            <select
              className="border rounded-md px-2 py-2 w-full bg-transparent relative z-10"
              value={form.team_code || ""}
              onChange={(e) => setForm(f => ({ ...f, team_code: e.target.value || undefined }))}
            >
              <option value="">— เลือกทีม —</option>
              {teams.map(t => (
                <option key={t.code} value={t.code}>
                  {t.code}{t.label ? ` — ${t.label}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm opacity-70">group_code</label>
            <select
              className="border rounded-md px-2 py-2 w-full bg-transparent relative z-10"
              value={form.group_code || ""}
              onChange={(e) => {
                const code = e.target.value || "";
                setForm(f => ({
                  ...f,
                  group_code: code || undefined,
                  group_name: code ? (groupNameByCode.get(code) || f.group_name || "") : "",
                }));
              }}
            >
              <option value="">— เลือกกลุ่ม —</option>
              {groups.map(g => (
                <option key={g.code} value={g.code}>
                  {g.code}{g.name ? ` — ${g.name}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="text-sm opacity-70">group_name</label>
            <Input value={form.group_name || ""} onChange={set("group_name")} placeholder="เช่น กลุ่มสินค้าในประเทศ" />
          </div>

          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={!!form.is_domestic}
                onChange={(e) => setForm(f => ({ ...f, is_domestic: e.target.checked }))}
              />
              ในประเทศ (is_domestic)
            </label>
          </div>

          <div className="sm:col-span-2">
            <label className="text-sm opacity-70">group_tag</label>
            <Input value={form.group_tag || ""} onChange={set("group_tag")} placeholder="เช่น เคมี-เกรดวิเคราะห์" />
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <Button onClick={save} disabled={busy}>{busy ? "Saving..." : "บันทึก"}</Button>
          <Button variant="outline" onClick={() => nav(-1)}>ยกเลิก</Button>
        </div>

        <div className="mt-3 text-xs opacity-70">
          * ฟอร์มนี้ยิง <code>POST /api/products/upsert</code> และอ่านด้วย <code>GET /api/products/get?sku=...</code><br />
          * รายการ Team/Group อ่านจากตาราง master (<code>teams</code>, <code>product_groups</code>)
        </div>
      </section>
    </div>
  );
}

