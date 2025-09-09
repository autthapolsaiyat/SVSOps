import { useAuth } from "../providers/AuthProvider";

export default function Sidebar() {
  const { can, isSuperadmin } = useAuth();

  return (
    <nav className="p-4 space-y-2">
      {/* เห็นทุกคน */}
      <a href="/dashboard">Dashboard</a>

      {/* เฉพาะคนที่มี perm หรือ superadmin */}
      {can("user:manage") && <a href="/admin/users">Admin → Users</a>}
      {can("session:manage") && <a href="/admin/sessions">Admin → Sessions</a>}
      {can("inventory:receive") && <a href="/inventory/receive">Inventory → Receive</a>}

      {/* ตัวอย่างป้ายบอก ถ้าเป็น superadmin */}
      {isSuperadmin && <div className="text-xs text-emerald-600">SUPERADMIN MODE</div>}
    </nav>
  );
}

