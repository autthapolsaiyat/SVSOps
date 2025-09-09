import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";

import ProductsPage from "./pages/ProductsPage";
import ProductFormPage from "./pages/ProductFormPage";
import QuotesPage from "./pages/QuotesPage";
import PurchaseOrdersPage from "./pages/PurchaseOrdersPage";
import GoodsReceiptsPage from "./pages/GoodsReceiptsPage";
import SalesOrdersPage from "./pages/SalesOrdersPage";
import InvoicesPage from "./pages/InvoicesPage";

const NotFound = () => <div>ไม่พบหน้า</div>;

export default function AppRoutes() {
  return (
    <Routes>
      {/* public */}
      <Route path="/login" element={<LoginPage />} />

      {/* private shell */}
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />

        {/* เมนูหลัก */}
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/products/new" element={<ProductFormPage />} />
        {/* ⬇️ ใหม่: route สำหรับแก้ไข ใช้ param ชื่อ sku */}
        <Route path="/products/edit/:sku" element={<ProductFormPage />} />

        <Route path="/quotes" element={<QuotesPage />} />
        <Route path="/purchase-orders" element={<PurchaseOrdersPage />} />
        <Route path="/goods-receipts" element={<GoodsReceiptsPage />} />
        <Route path="/sales-orders" element={<SalesOrdersPage />} />
        <Route path="/invoices" element={<InvoicesPage />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

