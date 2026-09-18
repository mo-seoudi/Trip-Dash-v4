// client/src/App.jsx
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import AccessControlPage from "./pages/Admin/AccessControlPage.jsx";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import FinancePage from "./pages/Finance";
import AllTrips from "./pages/AllTrips";
import BusBookings from "./pages/BusBookings";
import Settings from "./pages/Settings";
import ExternalQuotation from "./pages/ExternalQuotation.jsx";
import Layout from "./layout/Layout";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { WorkspaceProvider } from "./context/WorkspaceContext";
import ProtectedRoute from "./routes/ProtectedRoute";

function AuthenticatedWorkspace({ children }) { return <WorkspaceProvider>{children}</WorkspaceProvider>; }
function AppRoutes() {
  const { profile, loading } = useAuth();
  const externalQuotation = window.location.pathname === "/external/quotation";
  if (loading && !externalQuotation) return <div className="flex justify-center items-center h-screen text-lg">Loading, please wait...</div>;
  return <><Routes>
    <Route path="/external/quotation" element={<ExternalQuotation />} />
    <Route path="/login" element={<Login />} /><Route path="/register" element={<Register />} />
    {profile && <Route element={<AuthenticatedWorkspace><Layout /></AuthenticatedWorkspace>}>
      <Route path="/" element={<ProtectedRoute requiredPermission="trip.read"><Dashboard /></ProtectedRoute>} />
      <Route path="/finance" element={<ProtectedRoute requiredPermission="finance.read"><FinancePage /></ProtectedRoute>} />
      <Route path="/trips" element={<ProtectedRoute requiredPermission="trip.read"><AllTrips /></ProtectedRoute>} />
      <Route path="/bookings" element={<ProtectedRoute requiredPermission="trip.create"><BusBookings /></ProtectedRoute>} />
      <Route path="/admin/access" element={<ProtectedRoute requiredPermission="access.admin"><AccessControlPage /></ProtectedRoute>} />
      <Route path="/settings" element={<Settings />} />
    </Route>}
    <Route path="*" element={<Navigate to={profile ? "/" : "/login"} />} />
  </Routes><ToastContainer position="top-center" autoClose={2000} hideProgressBar closeOnClick pauseOnHover={false} draggable={false} /></>;
}
function App(){return <AuthProvider><BrowserRouter><AppRoutes /></BrowserRouter></AuthProvider>}
export default App;
