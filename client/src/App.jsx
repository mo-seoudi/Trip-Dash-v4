// src/App.jsx
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import TenantSetup from "./pages/TenantSetup";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import FinancePage from "./pages/Finance";
import TripDetails from "./pages/TripDetails";
import NotFound from "./pages/NotFound";
import AllTrips from "./pages/AllTrips";
import AdminRoles from "./pages/AdminRoles";
import AdminUsers from "./pages/AdminUsers";
import Settings from "./pages/Settings";

import Layout from "./layout/Layout";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ProtectedRoute from "./routes/ProtectedRoute";

function AppRoutes() {
  const { profile, loading } = useAuth();

  if (loading) {
    return <div className="flex justify-center items-center h-screen text-lg">Loading, please wait...</div>;
  }

  return (
    <>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/admin/tenant-setup" element={<TenantSetup />} />

        {/* Protected */}
        {profile && (
          <Route element={<Layout />}>
            <Route
              path="/"
              element={
                <ProtectedRoute allowedRoles={["school_staff", "bus_company", "trip_manager", "admin"]}>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/finance"
              element={
                <ProtectedRoute allowedRoles={["finance", "admin"]}>
                  <FinancePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/trips"
              element={
                <ProtectedRoute allowedRoles={["admin", "trip_manager"]}>
                  <AllTrips />
                </ProtectedRoute>
              }
            />
            <Route
              path="/trip/:id"
              element={
                <ProtectedRoute allowedRoles={["admin", "trip_manager", "school_staff", "bus_company"]}>
                  <TripDetails />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/roles"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminRoles />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminUsers />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute allowedRoles={["admin", "school_staff", "finance", "bus_company", "trip_manager"]}>
                  <Settings />
                </ProtectedRoute>
              }
            />
          </Route>
        )}

        {/* Fallback */}
        <Route path="*" element={<Navigate to={profile ? "/" : "/login"} />} />
      </Routes>

      <ToastContainer position="top-center" autoClose={2000} hideProgressBar closeOnClick pauseOnHover={false} draggable={false} />
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
