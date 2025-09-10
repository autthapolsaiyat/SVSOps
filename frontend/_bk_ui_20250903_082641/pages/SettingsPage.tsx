// FILE: src/pages/SettingsPage.tsx
import React, { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const KEY_TEAM = "app:default_team_id";
const KEY_COMP = "app:default_company_code";

export default function SettingsPage() {
  const [team, setTeam] = useState("");
  const [comp, setComp] = useState("SVS");

  useEffect(() => {
    try {
      setTeam(localStorage.getItem(KEY_TEAM) || "");
      setComp(localStorage.getItem(KEY_COMP) || "SVS");
    } catch {}
  }, []);

  function save() {
    try {
      localStorage.setItem(KEY_TEAM, team.toUpperCase().trim());
      localStorage.setItem(KEY_COMP, comp.toUpperCase().trim() || "SVS");
      toast.success("บันทึกค่าเริ่มต้นแล้ว");
    } catch {
      toast.error("บันทึกไม่ได้ (localStorage)");
    }
  }

  function clearAll() {
    try {
      localStorage.removeItem(KEY_TEAM);
      localStorage.removeItem(KEY_COMP);
      setTeam(""); setComp("SVS");
      toast.success("ล้างค่าที่ตั้งไว้แล้ว");
    } catch {}
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Settings</h1>

      <div className="rounded-xl border border-border/60 bg-card/10 p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <div className="text-sm opacity-70 mb-1">Default Company Code</div>
            <Input value={comp} onChange={e=>setComp(e.target.value)} placeholder="เช่น SVS"/>
          </div>
          <div>
            <div className="text-sm opacity-70 mb-1">Default Team ID</div>
            <Input value={team} onChange={e=>setTeam(e.target.value)} placeholder="เช่น STD, APP, SERV"/>
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={save}>บันทึก</Button>
          <Button variant="outline" onClick={clearAll}>ล้างค่า</Button>
        </div>

        <div className="text-sm opacity-70">
          * Quick Actions ใน Dashboard จะใช้ค่าที่ตั้งไว้ตรงนี้ก่อน หากไม่ตั้งไว้จะ fallback เป็น <code>VITE_DEFAULT_TEAM_ID</code>
        </div>
      </div>
    </div>
  );
}

