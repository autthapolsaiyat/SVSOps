// FILE: src/pages/ProductsNewPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

import {
  listTeams,
  listProductGroups,
  upsertProduct,
  type Team,
  type ProductGroup,
  type UpsertProductInput,
} from "@/lib/apiStock";

const schema = z.object({
  code: z.string().min(1, "กรุณากรอกรหัสสินค้า"),
  name: z.string().min(1, "กรุณากรอกชื่อสินค้า"),
  unit: z.string().min(1, "กรุณากรอกหน่วยนับ เช่น ชิ้น, กล่อง"),
  barcode: z.string().optional().nullable(),
  team_id: z.string().optional().nullable(),
  group_id: z.string().optional().nullable(),
  price: z
    .preprocess((v) => (v === "" || v === null || v === undefined ? undefined : Number(v)), z.number().nonnegative("ราคาต้องเป็น 0 หรือมากกว่า").optional())
    .nullable(),
  cost: z
    .preprocess((v) => (v === "" || v === null || v === undefined ? undefined : Number(v)), z.number().nonnegative("ต้นทุนต้องเป็น 0 หรือมากกว่า").optional())
    .nullable(),
  reorder_level: z
    .preprocess((v) => (v === "" || v === null || v === undefined ? undefined : Number(v)), z.number().min(0, "ต้องเป็นจำนวนเต็ม 0 หรือมากกว่า").optional())
    .nullable(),
  is_active: z.boolean().default(true),
  description: z.string().optional().nullable(),
});

type FormValues = z.infer<typeof schema>;

export default function ProductsNewPage() {
  const navigate = useNavigate();

  const [teams, setTeams] = useState<Team[]>([]);
  const [groups, setGroups] = useState<ProductGroup[]>([]);
  const [loadingDD, setLoadingDD] = useState(true);

  const defaultTeamId = useMemo(() => {
    return import.meta.env.VITE_DEFAULT_TEAM_ID as string | undefined;
  }, []);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: "",
      name: "",
      unit: "ชิ้น",
      barcode: "",
      team_id: defaultTeamId || undefined,
      group_id: undefined,
      price: undefined,
      cost: undefined,
      reorder_level: 0,
      is_active: true,
      description: "",
    },
    mode: "onChange",
  });

  useEffect(() => {
    // โหลด dropdown
    (async () => {
      try {
        setLoadingDD(true);
        const [t, g] = await Promise.all([listTeams(), listProductGroups()]);
        setTeams(t || []);
        setGroups(g || []);
      } catch (e: any) {
        toast.error(`โหลดข้อมูลประกอบไม่สำเร็จ: ${e?.message || e}`);
      } finally {
        setLoadingDD(false);
      }
    })();
  }, []);

  const onSubmit = async (values: FormValues) => {
    const payload: UpsertProductInput = {
      code: values.code.trim(),
      name: values.name.trim(),
      unit: values.unit.trim(),
      barcode: values.barcode?.toString().trim() || null,
      team_id: values.team_id || null,
      group_id: values.group_id || null,
      price: values.price ?? null,
      cost: values.cost ?? null,
      reorder_level: values.reorder_level ?? null,
      is_active: values.is_active,
      description: values.description?.toString() || null,
    };

    try {
      const res = await upsertProduct(payload);
      toast.success(`บันทึกสำเร็จ: ${res.code} — ${res.name}`);
      navigate("/products");
    } catch (e: any) {
      // ดึง detail/message จาก API ถ้ามี
      const msg = e?.message || "บันทึกไม่สำเร็จ";
      toast.error(msg);
    }
  };

  const isSubmitting = form.formState.isSubmitting;

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">ป้อนสินค้าใหม่</h1>
        <p className="text-sm text-muted-foreground">
          กรอกข้อมูลด้านล่างให้ครบ แล้วกด “บันทึก”
        </p>
      </div>

      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-6"
        noValidate
      >
        {/* รหัส + ชื่อ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1">
            <Label htmlFor="code">รหัสสินค้า *</Label>
            <Input
              id="code"
              placeholder="เช่น P-0001"
              {...form.register("code")}
              disabled={isSubmitting}
            />
            {form.formState.errors.code && (
              <p className="text-sm text-red-500 mt-1">
                {form.formState.errors.code.message}
              </p>
            )}
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="name">ชื่อสินค้า *</Label>
            <Input
              id="name"
              placeholder="เช่น ถุงมือยางไนไตรล์"
              {...form.register("name")}
              disabled={isSubmitting}
            />
            {form.formState.errors.name && (
              <p className="text-sm text-red-500 mt-1">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>
        </div>

        {/* หน่วย + บาร์โค้ด */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="unit">หน่วยนับ *</Label>
            <Input
              id="unit"
              placeholder="เช่น ชิ้น / กล่อง"
              {...form.register("unit")}
              disabled={isSubmitting}
            />
            {form.formState.errors.unit && (
              <p className="text-sm text-red-500 mt-1">
                {form.formState.errors.unit.message}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="barcode">บาร์โค้ด</Label>
            <Input
              id="barcode"
              placeholder="(ถ้ามี)"
              {...form.register("barcode")}
              disabled={isSubmitting}
            />
          </div>
        </div>

        {/* ทีม + กลุ่มสินค้า */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>ทีม</Label>
            <Select
              disabled={isSubmitting || loadingDD}
              value={form.watch("team_id") ?? ""}
              onValueChange={(v) => form.setValue("team_id", v || undefined, { shouldDirty: true })}
            >
              <SelectTrigger>
                <SelectValue placeholder="เลือกทีม (ถ้ามี)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">- ไม่ระบุ -</SelectItem>
                {teams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}{t.code ? ` (${t.code})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>กลุ่มสินค้า</Label>
            <Select
              disabled={isSubmitting || loadingDD}
              value={form.watch("group_id") ?? ""}
              onValueChange={(v) => form.setValue("group_id", v || undefined, { shouldDirty: true })}
            >
              <SelectTrigger>
                <SelectValue placeholder="เลือกกลุ่มสินค้า (ถ้ามี)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">- ไม่ระบุ -</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}{g.code ? ` (${g.code})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ราคา/ต้นทุน/จุดสั่งซื้อ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="price">ราคาขาย</Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              placeholder="เช่น 120.00"
              {...form.register("price")}
              disabled={isSubmitting}
            />
            {form.formState.errors.price && (
              <p className="text-sm text-red-500 mt-1">
                {form.formState.errors.price.message as any}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="cost">ต้นทุน</Label>
            <Input
              id="cost"
              type="number"
              step="0.01"
              placeholder="เช่น 80.00"
              {...form.register("cost")}
              disabled={isSubmitting}
            />
            {form.formState.errors.cost && (
              <p className="text-sm text-red-500 mt-1">
                {form.formState.errors.cost.message as any}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="reorder_level">จุดสั่งซื้อ (ชิ้น)</Label>
            <Input
              id="reorder_level"
              type="number"
              step="1"
              placeholder="เช่น 10"
              {...form.register("reorder_level")}
              disabled={isSubmitting}
            />
            {form.formState.errors.reorder_level && (
              <p className="text-sm text-red-500 mt-1">
                {form.formState.errors.reorder_level.message as any}
              </p>
            )}
          </div>
        </div>

        {/* สถานะ / คำอธิบาย */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          <div className="flex items-center gap-3">
            <Switch
              checked={!!form.watch("is_active")}
              onCheckedChange={(v) => form.setValue("is_active", v, { shouldDirty: true })}
              disabled={isSubmitting}
              id="is_active"
            />
            <Label htmlFor="is_active">เปิดใช้งาน</Label>
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="description">คำอธิบาย</Label>
            <Textarea
              id="description"
              rows={3}
              placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)"
              {...form.register("description")}
              disabled={isSubmitting}
            />
          </div>
        </div>

        {/* ปุ่มคำสั่ง */}
        <div className="flex gap-3">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "กำลังบันทึก..." : "บันทึก"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/products")}
            disabled={isSubmitting}
          >
            ยกเลิก
          </Button>
        </div>
      </form>
    </div>
  );
}

