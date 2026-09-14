//client/src/App.jsx
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import GlobalAdminPage from "./pages/Admin/GlobalAdminPage.jsx"

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import FinancePage from "./pages/Finance";
import AllTrips from "./pages/AllTrips";
import BusBookings from "./pages/BusBookings";
import AdminRoles from "./pages/AdminRoles";
import AdminUsers from "./pages/AdminUsers";
import Settings from "./pages/Settings";
import AdminApprovals from "./pages/AdminApprovals";

import Layout from "./layout/Layout";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { WorkspaceProvider } from "./context/WorkspaceContext";
import ProtectedRoute from "./routes/ProtectedRoute";

function AuthenticatedWorkspace({ children }) {
  return <WorkspaceProvider>{children}</WorkspaceProvider>;
}

function AppRoutes() {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen text-lg">
        Loading, please wait...
      </div>
    );
  }

  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {profile && (
          <Route element={<AuthenticatedWorkspace><Layout /></AuthenticatedWorkspace>}>
            <Route path="/" element={<ProtectedRoute allowedRoles={["school_staff", "bus_operator", "trip_manager", "admin"]}><Dashboard /></ProtectedRoute>} />
            <Route path="/finance" element={<ProtectedRoute allowedRoles={["finance", "admin"]}><FinancePage /></ProtectedRoute>} />
            <Route path="/trips" element={<ProtectedRoute allowedRoles={["admin","trip_manager","school_staff","bus_operator","finance"]}><AllTrips /></ProtectedRoute>} />
            <Route path="/bookings" element={<ProtectedRoute allowedRoles={["school_staff","trip_manager","admin"]}><BusBookings /></ProtectedRoute>} />
            <Route path="/admin/roles" element={<ProtectedRoute allowedRoles={["admin"]}><AdminRoles /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute allowedRoles={["admin"]}><AdminUsers /></ProtectedRoute>} />
            <Route path="/admin/approvals" element={<ProtectedRoute allowedRoles={["admin"]}><AdminApprovals /></ProtectedRoute>} />
            <Route path="/admin/global" element={<ProtectedRoute allowedRoles={["admin"]}><GlobalAdminPage /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute allowedRoles={["school_staff","bus_operator","trip_manager","admin","finance"]}><Settings /></ProtectedRoute>} />
          </Route>
        )}

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
