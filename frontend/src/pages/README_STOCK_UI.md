// ————————————————————————————————————————————————
// FILE: src/pages/README_STOCK_UI.md — usage notes
//--------------------------------------------------
# SVS‑Ops Stock UI Pages


## Mapping เมนู
- Dashboard → `/dashboard`
- ใบเสนอราคา → `/quotes`
- ใบสั่งซื้อ → `/po`
- นำสินค้าเข้าสต๊อก (GR) → `/gr`
- ขาย/วางบิล (Sales Orders) → `/sales`
- ใบวางบิล/ตัดสต๊อค (Invoices) → `/invoices`


## TODO Hook Backend
- สร้าง/ตรวจสอบ API เหล่านี้ใน FastAPI
- GET `/dashboard/summary`
- GET/POST/PUT `/quotes`, `/quotes/{id}`, POST `/quotes/{id}/send`
- GET/POST/PUT `/purchase-orders`, `/purchase-orders/{id}`, POST `/purchase-orders/{id}/submit`
- GET/POST `/inventory/receipts`, POST `/inventory/receipts/{id}/post`
- GET `/sales/orders`, POST `/sales/orders/{id}/confirm`, POST `/sales/orders/{id}/deliver`, POST `/sales/orders/{id}/invoice`
- GET `/billing/invoices`, POST `/billing/invoices/{id}/pay`


- ตรวจสอบ RBAC/permissions ที่ต้องใช้ เช่น `sales:quote`, `purchase:order`, `inventory:receive`, `sales:order`, `billing:invoice` และซ่อนปุ่มถ้าไม่มีสิทธิ์


## Styling
- ใช้ shadcn/ui + Tailwind. Cards rounded-2xl, spacing p-6.


## Tips
- ถ้าใช้ Traefik/Caddy ให้ทำ proxy `/api` → backend 8080
- ตั้งค่า env: `VITE_API_BASE=/api`
