## Stock UI Compatibility — Notes (2025-09-09)

### Backend
- เพิ่ม/ปรับ `app/routers/stock_ui_compat.py`
  - `POST /api/products/upsert`  
    รองรับ body: `sku,name,unit,price_ex_vat` และ meta เสริม `team_code,group_code,group_name,is_domestic,group_tag`  
    บันทึกสินค้าในตาราง `products` และบันทึก meta ลงตารางเสริม `products_meta` (สร้างอัตโนมัติถ้ายังไม่มี)
  - `GET /api/products/get?sku=...`  
    คืนข้อมูลสินค้า + meta
  - `GET /api/products/list`  
    รองรับค้นหา/เรียง/แบ่งหน้า และ filter: `team_code,group_code,origin(domestic|foreign|unassigned)`
- ใช้ dependency จาก `app.deps` (`get_db`, `require_user / require_perm`) แก้ import ให้สอดคล้องโครงสร้างจริง
- แก้ให้รองรับสคีมาที่ต่างกัน (เช่น `unit` vs `uom`, `price_ex_vat` vs `price`) แบบ fallback

### Frontend
- `src/lib/api.products.ts`
  - ฟังก์ชัน `listProducts`, `getProductBySku`, `upsertProduct`, `listTeams`, `listGroups`
  - ใช้ `VITE_API_BASE` (เช่น `http://localhost:8080/api`) สำหรับเรียก API
- `src/pages/ProductsPage.tsx`
  - ตารางสินค้า + filter/search + แก้ไขผ่านปุ่ม Edit
- `src/pages/ProductFormPage.tsx`
  - ฟอร์มเพิ่ม/แก้ไข รองรับ field: `sku,name,unit,team_code,group_code,group_name,is_domestic,group_tag`
  - โหมดแก้ไขดึงค่าจาก `GET /api/products/get`
- `src/components/Layout.tsx`
  - เพิ่มปุ่ม **Logout** ที่ header
- `vite.config.ts`
  - Proxy `/api` ไปที่ `VITE_API_URL` (เช่น `http://localhost:8080/api`)
- `package.json`
  - เพิ่มสคริปต์ dev แบบโชว์ IP/host (optional):  
    `"dev:host": "vite --host", "dev:net": "vite --host --mode network"`

### .env ตัวอย่าง (frontend)

# SVS-Ops — Product CRUD + Auth + Proxy

โครงการนี้ปรับให้ **เพิ่ม/แก้ไข/ค้นหา สินค้า** ได้ครบ พร้อม **Login/Logout** และตั้งค่า **Vite Proxy** ให้ยิง `/api` ไป Backend อัตโนมัติ

---

## โครงสร้างที่แก้ในรอบนี้

### Frontend
- `src/lib/api.products.ts`
  - เพิ่ม/ปรับเลเยอร์ API:
    - `listTeams()` → `GET /api/products/teams`
    - `listGroups()` → `GET /api/products/groups`
    - `listProducts()` → `GET /api/products/list` (รองรับ `q, sort, order, team_code, group_code, origin, page/per_page`)
    - `getProductBySku()` → `GET /api/products/get?sku=...`
    - `upsertProduct()` → `POST /api/products/upsert` (ส่ง `team_code, group_code, group_name, is_domestic, group_tag`; แนบ Bearer token จาก `localStorage.token`; ใส่ `X-Team-Id` จาก `VITE_DEFAULT_TEAM_ID`)
- `src/pages/ProductsPage.tsx`  
  ตาราง+ฟิลเตอร์ครบ (ค้นหา/ทีม/กลุ่ม/ที่มา/เพจิ้ง) + ปุ่มแก้ไข
- `src/pages/ProductFormPage.tsx`  
  ฟอร์มเพิ่ม/แก้ไขสินค้า (prefill, map group → group_name, validate, upsert)
- `src/components/Layout.tsx`  
  เพิ่มปุ่ม **Logout** และเมนูหลัก
- `src/AppRoutes.tsx`  
  เส้นทางใหม่: `/products/new`, `/products/edit/:sku`
- `src/main.tsx`  
  ครอบ `<BrowserRouter>` ให้ Routing ทำงาน
- `vite.config.ts`  
  Proxy `/api` → API_ROOT (อ่านจาก `VITE_API_URL` หรือ fallback `http://localhost:8080`), เปิด `server.host=true`
- `package.json`  
  สคริปต์ dev แบบโชว์ IP:
  ```json
  {
    "scripts": {
      "dev": "vite",
      "dev:host": "vite --host",
      "dev:lan": "vite --host --mode network",
      "build": "tsc -b && vite build",
      "lint": "eslint .",
      "preview": "vite preview"
    }
  }
Backend
backend/app/routers/stock_ui_compat.py

Endpoints สินค้า (พร้อม meta):

POST /api/products/upsert — upsert ลง products + meta ลงตาราง products_meta

GET /api/products/get?sku=... — คืนสินค้าพร้อม meta

GET /api/products/list — ลิสต์ + ฟิลเตอร์ (q/sort/order/team_code/group_code/origin) + เพจิ้ง

ใช้ from app.deps import get_db (แก้ import เดิม)

สร้าง/บำรุง products_meta อัตโนมัติ (มี CREATE TABLE IF NOT EXISTS)

backend/requirements.txt

เฉพาะ auth: ใช้ passlib[bcrypt]==1.7.4 เพื่อเลี่ยงปัญหา bcrypt
Backend

backend/app/routers/stock_ui_compat.py

Endpoints สินค้า (พร้อม meta):

POST /api/products/upsert — upsert ลง products + meta ลงตาราง products_meta

GET /api/products/get?sku=... — คืนสินค้าพร้อม meta

GET /api/products/list — ลิสต์ + ฟิลเตอร์ (q/sort/order/team_code/group_code/origin) + เพจิ้ง

ใช้ from app.deps import get_db (แก้ import เดิม)

สร้าง/บำรุง products_meta อัตโนมัติ (มี CREATE TABLE IF NOT EXISTS)

backend/requirements.txt

เฉพาะ auth: ใช้ passlib[bcrypt]==1.7.4 เพื่อเลี่ยงปัญหา bcrypt

Environment

Frontend (.env.local)

# proxy target (vite.config จะอ่าน VITE_API_URL ถ้ามี)
VITE_API_BASE=http://localhost:8080/api
VITE_API_URL=http://localhost:8080/api
VITE_DEFAULT_TEAM_ID=e29e7da3-ecae-4184-a1dd-82320c918692
VITE_ENABLE_DASHBOARD=1

Development
Backend
docker compose up -d backend
curl -s http://localhost:8080/api/ready && echo

Frontend
npm install
npm run dev:host   # ให้เครื่องอื่นใน LAN เข้าได้ เช่น http://<IP>:5173

Smoke Test (curl)
# 1) login
LOGIN_JSON=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin"}')
TOKEN=$(jq -r '.access_token // .token // .data.access_token // empty' <<<"$LOGIN_JSON")

# 2) upsert (พร้อม meta)
curl -s -X POST http://localhost:8080/api/products/upsert \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Team-Id: e29e7da3-ecae-4184-a1dd-82320c918692" \
  -H "Content-Type: application/json" \
  -d '{"sku":"TEAM004","name":"Test004","unit":"EA","price_ex_vat":0,
       "team_code":"STD","group_code":"GLASS","group_name":"เครื่องแก้ว","is_domestic":true}' | jq .

# 3) get
curl -s "http://localhost:8080/api/products/get?sku=TEAM004" \
  -H "Authorization: Bearer $TOKEN" | jq .

# 4) list (filter by group_code)
curl -s "http://localhost:8080/api/products/list?limit=10&offset=0&group_code=GLASS" \
  -H "Authorization: Bearer $TOKEN" | jq .

Troubleshooting

bcrypt / passlib error: ใช้ passlib[bcrypt]==1.7.4 (ตาม requirements.txt) แล้ว rebuild backend:

docker compose build --no-cache backend && docker compose up -d backend


Frontend เรียก API ไม่ได้ (Failed to fetch): เช็ค VITE_API_URL และ vite.config.ts proxy

สคริปต์ที่น่าจำ
# รัน backend
docker compose up -d backend

# รัน frontend แบบโชว์ IP
npm run dev:host



////////////



สุดยอดครับ! สรุป “ไฟล์ที่เกี่ยวข้อง + เปลี่ยนอะไรไปบ้าง” แบบจับต้องได้ให้เลย 👇

Frontend

src/lib/api.products.ts
เลเยอร์ API ใหม่:

listTeams() → /api/products/teams

listGroups() → /api/products/groups

listProducts() → /api/products/list (รองรับ q, sort, order, team_code, group_code, origin, page/per_page)

getProductBySku() → /api/products/get?sku=...

upsertProduct() → /api/products/upsert (ส่ง team_code, group_code, group_name, is_domestic, group_tag; auto ใส่ X-Team-Id จาก VITE_DEFAULT_TEAM_ID; ใช้ localStorage.token เป็น Bearer)

src/pages/ProductsPage.tsx
ตารางสินค้า + ฟิลเตอร์ (ค้นหา/ทีม/กลุ่ม/ที่มา/จัดหน้า), ปุ่มแก้ไข → /products/edit/:sku.

src/pages/ProductFormPage.tsx
ฟอร์มเพิ่ม/แก้ไขสินค้า:

อ่านเดิมด้วย getProductBySku() และ prefill

เลือกกลุ่มแล้ว auto เติม group_name (ถ้ายังว่าง)

ทำความสะอาดค่า (trim/ไม่ส่ง "") ก่อน upsertProduct()

ส่งฟิลด์ meta ได้ครบ (team_code/group_code/group_name/is_domestic/group_tag)

src/components/Layout.tsx
เพิ่มปุ่ม Logout (โชว์/ทำงานได้จริง), โครงเมนูหลัก

src/AppRoutes.tsx
โครงเราท์หลัก + เส้นทางใหม่:

/products/new (เพิ่มสินค้า)

/products/edit/:sku (แก้ไขสินค้า)

src/main.tsx
ครอบด้วย <BrowserRouter> เพื่อให้ Routing ทำงานสมบูรณ์

vite.config.ts
ตั้ง proxy ให้เรียก /api ไป API_ROOT (ดึงจาก VITE_API_URL หรือใช้ http://localhost:8080), เปิด host: true สำหรับทดสอบผ่าน IP/LAN, ใส่ config ฝั่ง preview เช่นกัน

package.json
เพิ่มสคริปต์รัน dev แบบโชว์ IP:

{
  "scripts": {
    "dev": "vite",
    "dev:host": "vite --host",
    "dev:lan": "vite --host --mode network",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "preview": "vite preview"
  }
}


.env.local
คีย์ที่ใช้งาน:

VITE_API_BASE=http://localhost:8080/api   # หรือไม่ใส่ แล้วปล่อยให้ใช้ /api (proxy)
VITE_DEFAULT_TEAM_ID=e29e7da3-ecae-4184-a1dd-82320c918692
VITE_ENABLE_DASHBOARD=1
# (ถ้าใช้ proxy แบบ vite.config แนะนำ VITE_API_URL=http://localhost:8080/api)

Backend

backend/app/routers/stock_ui_compat.py
เพิ่ม/ปรับ endpoints สำหรับ UI สินค้า:

POST /api/products/upsert → upsert ลงตาราง products + เก็บ meta ลงตาราง products_meta (มี CREATE TABLE IF NOT EXISTS)

GET /api/products/get?sku=... → คืนข้อมูลสินค้าพร้อม meta

GET /api/products/list → ลิสต์สินค้า + ฟิลเตอร์ (q/sort/order/team_code/group_code/origin) + เพจิ้ง

รองรับ team_id จาก body หรือ header X-Team-Id

เปลี่ยน import เป็น from app.deps import get_db (แก้ error import เดิม)

ใช้ SQLAlchemy แบบ sync Session กับ helper meta (ensure_products_meta, upsert_products_meta, get_products_meta)

backend/requirements.txt
แก้ dependency auth ให้เสถียร:

เปลี่ยนเป็น passlib[bcrypt]==1.7.4 (แก้ปัญหา bcrypt __about__)

รักษาเวอร์ชัน fastapi / uvicorn / pydantic / SQLAlchemy ตามที่รันผ่าน

โน้ตสั้นๆ เรื่องการทดสอบ

curl smoke test ที่ใช้เช็ก:

login รับ token

POST /api/products/upsert พร้อม meta

GET /api/products/get?sku=... ตรวจค่ากลับ

GET /api/products/list?... ตรวจฟิลเตอร์ group_code/origin

ฝั่งหน้าเว็บ: ลองเพิ่ม/แก้ไขสินค้า → กลับไปหน้า list → ค้น/กรอง เพื่อยืนยันค่า meta แสดงครบ

ถ้าจะทำ commit แยกเป็นสองชุด:

feat(frontend): product CRUD + filters + login/logout + vite proxy

feat(backend): products upsert/get/list + meta table + deps fix (passlib[bcrypt])
## DB: updated_at triggers for Customers/Vendors + Views

> วันที่ทำ: 2025-09-09

ฟีเจอร์นี้ทำให้ฐานข้อมูลอัปเดตฟิลด์ `updated_at` อัตโนมัติเมื่อมีการแก้ไขข้อมูลลูกค้า/ผู้ขาย และเปิดให้เรียง/กรองตามเวลาที่อัปเดตล่าสุดได้ง่าย ทั้งผ่าน SQL ตรงและผ่าน API/แอปในอนาคต

### มีอะไรเปลี่ยนบ้าง
- **คอลัมน์**
  - เพิ่ม `updated_at TIMESTAMPTZ DEFAULT now()` ในตาราง `customers`, `vendors`
  - เพิ่ม `note` (มีสคริปต์ migrate กันกรณีตารางมีอยู่ก่อน)
- **Triggers + Function**
  - ฟังก์ชัน `set_updated_at()` (PL/pgSQL)
  - ทริกเกอร์:  
    - `trg_customers_updated_at` บน `customers`  
    - `trg_vendors_updated_at` บน `vendors`
- **Views**
  - `customers_std`, `vendors_std` — ตอนนี้มีฟิลด์ `updated_at` รวมอยู่แล้ว
- **Indexes**
  - B-Tree: `idx_customers_code`, `idx_customers_name`, `idx_vendors_code`, `idx_vendors_name`
  - (ทางเลือก) `pg_trgm` + GIN บน `name` สำหรับค้นหา fuzzy
  - (ทางเลือก) B-Tree บน `updated_at` เพื่อสั่งเรียงเร็ว (`ORDER BY updated_at DESC`) ได้ไวขึ้น
- **สคริปต์ & Makefile**
  - `scripts/db_updated_at.sh` — one-shot, idempotent (รันซ้ำได้)
  - `make db-updated-at` เรียกสคริปต์นี้
  - ยูทิล: `customers-std-updated`, `vendors-std-updated` แสดง 10 รายการที่อัปเดตล่าสุด

### รันอย่างไร (Docker Compose)
```bash
make db-updated-at
# หรือเรียกตรง:
./scripts/db_updated_at.sh

