// FILE: src/pages/HomePage.tsx
import React, { useState } from "react";
import { logout, getUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  const me = getUser();
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          old_password: oldPwd,
          new_password: newPwd,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setMsg("เปลี่ยนรหัสผ่านสำเร็จ");
      setOldPwd("");
      setNewPwd("");
    } catch (e: any) {
      setMsg(e.message || "เปลี่ยนรหัสผ่านไม่สำเร็จ");
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">หน้าแรก</h1>
          <div className="text-sm text-muted-foreground">
            ผู้ใช้: {me?.username ?? "-"}
          </div>
        </div>
        <Button onClick={() => logout()}>Logout</Button>
      </div>

      <form onSubmit={changePassword} className="space-y-2 max-w-sm">
        <div className="font-medium">เปลี่ยนรหัสผ่าน</div>
        <input
          className="border rounded px-3 py-2 w-full"
          type="password"
          placeholder="รหัสผ่านเดิม"
          value={oldPwd}
          onChange={(e) => setOldPwd(e.target.value)}
        />
        <input
          className="border rounded px-3 py-2 w-full"
          type="password"
          placeholder="รหัสผ่านใหม่"
          value={newPwd}
          onChange={(e) => setNewPwd(e.target.value)}
        />
        <Button type="submit">บันทึก</Button>
        {msg && <div className="text-sm">{msg}</div>}
      </form>
    </div>
  );
}

