import React from "react";
import FeatureTile from "@/components/FeatureTile";
import { Package, LayoutList, Upload, User2, ScanLine } from "lucide-react";

export default function HomeTilesPage() {
  const items = [
    { to: "/products", label: "สินค้า", icon: Package, scheme: "sky" as const },
    { to: "/levels", label: "ตรวจยอดคงเหลือ", icon: LayoutList, scheme: "teal" as const },
    { to: "/stock", label: "สแกน/รับ-ตัด", icon: ScanLine, scheme: "emerald" as const },
    { to: "/importer", label: "นำเข้าสินค้า", icon: Upload, scheme: "violet" as const },
    { to: "/me", label: "โปรไฟล์", icon: User2, scheme: "amber" as const },
  ];
  return (
    <div className="p-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
        {items.map((it) => (
          <FeatureTile key={it.to} {...it} />
        ))}
      </div>
    </div>
  );
}

