import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { profile, loading } = useAuth();

  if (loading) {
    return <div className="p-6">Loading session...</div>;
  }

  if (!profile) return <Navigate to="/login" />;
  if (allowedRoles && !allowedRoles.includes(profile.role)) return <Navigate to="/unauthorized" />;

  return children;
};

export default ProtectedRoute;
