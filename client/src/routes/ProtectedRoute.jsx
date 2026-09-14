import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useWorkspace } from "../context/WorkspaceContext";

const ProtectedRoute = ({ children, allowedRoles, requiredPermission, requiredPermissions }) => {
  const { profile, loading: authLoading } = useAuth();
  const { loading: accessLoading, can } = useWorkspace();

  if (authLoading || accessLoading) {
    return <div className="p-6 text-sm text-slate-500">Loading access…</div>;
  }

  if (!profile) return <Navigate to="/login" />;

  const permissions = requiredPermissions || (requiredPermission ? [requiredPermission] : []);
  if (permissions.length && !permissions.every((permission) => can(permission))) {
    return <Navigate to="/unauthorized" />;
  }

  // Transitional fallback for pages not yet moved to canonical permissions.
  if (!permissions.length && allowedRoles && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/unauthorized" />;
  }

  return children;
};

export default ProtectedRoute;
