// FILE: src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import React, { useEffect } from "react";

import { useAuth } from "@/lib/auth.store";
import { RequireAuth } from "@/hooks/useAuthGuard";
import RequirePerm from "@/hooks/RequirePerm";

import AppShell from "@/layouts/AppShell";
import LoginPage from "@/pages/LoginPage";
import SessionsPage from "@/pages/SessionsPage";
import AdminUsersPage from "@/pages/AdminUsersPage";
import InventoryReceivePage from "@/pages/InventoryReceivePage";
import MePage from "@/pages/MePage";
import { ErrorBoundary } from "@/components/ErrorBoundary";

import Dashboard from "@/pages/Dashboard";
import SOList from "@/pages/SOList";
import SOForm from "@/pages/SOForm";
import QuotationsPage from "@/pages/QuotationsPage";
import SalesRepsPage from "@/pages/SalesRepsPage";
import SettingsPage from "@/pages/SettingsPage";

import RolesPage from "@/pages/RolesPage";
import PermissionsPage from "@/pages/PermissionsPage";
import ReportsPage from "@/pages/ReportsPage";
import ImporterPage from "@/pages/ImporterPage";
import InventoryAdjustPage from "@/pages/InventoryAdjustPage";
import InventoryIssuePage from "@/pages/InventoryIssuePage";
import InventoryTransferPage from "@/pages/InventoryTransferPage";

import ProductsPage from "@/pages/ProductsPage";
import CustomersPage from "@/pages/CustomersPage";
import StaffGroupsPage from "@/pages/StaffGroupsPage";

import POsPage from "@/pages/POsPage";
import SOsPage from "@/pages/SOsPage";

import { useTheme } from "@/lib/theme.store";

const DASH_ENABLED =
  ((import.meta as any).env?.VITE_ENABLE_DASHBOARD ?? "0") === "1";
const DEFAULT_PATH = DASH_ENABLED ? "/dashboard" : "/products";

// helper /logout route
function LogoutRoute() {
  const { logout } = useAuth();
  useEffect(() => {
    logout();
    location.assign("/login");
  }, [logout]);
  return null;
}

export default function App() {
  const { hydrate } = useAuth();
  const { dark } = useTheme();

  // hydrate หนเดียวพอ
  useEffect(() => { hydrate(); }, [hydrate]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <BrowserRouter>
        <Toaster richColors position="top-right" theme={dark ? "dark" : "light"} />

        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/logout" element={<LogoutRoute />} />

          {/* Protected + AppShell */}
          <Route
            path="/"
            element={
              <ErrorBoundary>
                <RequireAuth>
                  <AppShell />
                </RequireAuth>
              </ErrorBoundary>
            }
          >
            <Route index element={<Navigate to={DEFAULT_PATH} replace />} />

            {DASH_ENABLED && (
              <Route
                path="dashboard"
                element={
                  <RequirePerm need="products:read">
                    <Dashboard />
                  </RequirePerm>
                }
              />
            )}

            <Route path="me" element={<MePage />} />
            <Route path="sessions" element={<SessionsPage />} />

            {/* Admin */}
            <Route path="admin/users" element={<RequirePerm need="user:view"><AdminUsersPage/></RequirePerm>} />
            <Route path="admin/roles" element={<RequirePerm need="role:view"><RolesPage/></RequirePerm>} />
            <Route path="admin/permissions" element={<RequirePerm need="perm:view"><PermissionsPage/></RequirePerm>} />

            {/* Master Data */}
            <Route path="products" element={<RequirePerm need="products:read"><ProductsPage/></RequirePerm>} />
            <Route path="customers" element={<CustomersPage/>} />
            <Route path="staff-groups" element={<StaffGroupsPage/>} />

            {/* Inventory */}
            <Route path="inventory/receive"  element={<RequirePerm need="stock:receive"><InventoryReceivePage/></RequirePerm>} />
            <Route path="inventory/adjust"   element={<RequirePerm need="stock:adjust"><InventoryAdjustPage/></RequirePerm>} />
            <Route path="inventory/issue"    element={<RequirePerm need="stock:issue"><InventoryIssuePage/></RequirePerm>} />
            <Route path="inventory/transfer" element={<RequirePerm need="stock:transfer"><InventoryTransferPage/></RequirePerm>} />

            {/* SO */}
            <Route path="sales-orders"      element={<RequirePerm need="so:read"><SOList/></RequirePerm>} />
            <Route path="sales-orders/new"  element={<RequirePerm need="so:create"><SOForm/></RequirePerm>} />
            <Route path="sales-orders/:id"  element={<RequirePerm need="so:update"><SOForm/></RequirePerm>} />

            {/* Quick */}
            <Route path="purchases" element={<RequirePerm need="po:create"><POsPage/></RequirePerm>} />
            <Route path="sales/new" element={<RequirePerm need="so:create"><SOsPage/></RequirePerm>} />

            {/* Quotations / Sales Reps */}
            <Route path="quotations" element={<RequirePerm need="quote:create"><QuotationsPage/></RequirePerm>} />
            <Route path="sales-reps" element={<RequirePerm need="quote:update"><SalesRepsPage/></RequirePerm>} />

            {/* Tools */}
            <Route path="reports"  element={<RequirePerm need="report:view"><ReportsPage/></RequirePerm>} />
            <Route path="importer" element={<RequirePerm need="import:data"><ImporterPage/></RequirePerm>} />

            {/* Settings */}
            <Route path="settings" element={<SettingsPage/>} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to={DEFAULT_PATH} replace />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

