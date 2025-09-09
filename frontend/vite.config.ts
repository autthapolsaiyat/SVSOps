// vite.config.ts
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  /**
   * ตั้งค่าแนะนำใน .env.local
   *   VITE_API_BASE=/api                      // ฝั่ง frontend เรียกแบบ relative เสมอ
   *   VITE_API_URL=http://localhost:8080/api  // ไว้ให้ proxy ชี้ไป backend จริง
   *
   * หมายเหตุ: ถ้า VITE_API_URL เป็น http(s) จะตัดท้าย /api ออกเพื่อได้ ROOT สำหรับ proxy
   */
  const apiUrl = env.VITE_API_URL || "http://localhost:8080/api";
  const API_ROOT = /^https?:\/\//i.test(apiUrl)
    ? apiUrl.replace(/\/api\/?$/, "") // e.g. http://localhost:8080
    : "http://localhost:8080";

  return {
    plugins: [react()],
    resolve: { alias: { "@": path.resolve(__dirname, "src") } },

    server: {
      host: true,        // ให้เข้าถึงผ่าน IP/LAN ได้ (เช่น 192.168.x.x:5173)
      port: 5173,
      strictPort: true,
      proxy: {
        "/api": {
          target: API_ROOT,
          changeOrigin: true,
          secure: false,
          // ws: true,   // เปิดถ้าต้องใช้เว็บซ็อกเก็ต
        },
      },
    },

    preview: {
      host: true,        // ให้ preview ใช้จากเครื่องอื่นได้ด้วย
      port: 4173,
      proxy: {
        "/api": {
          target: API_ROOT,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});

