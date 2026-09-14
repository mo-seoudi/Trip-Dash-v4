import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import api from "../services/apiClient";
import { useAuth } from "./AuthContext";

const WorkspaceContext = createContext(null);
const PORTFOLIO = "portfolio";

export function WorkspaceProvider({ children }) {
  const { profile, loading: authLoading } = useAuth();
  const [access, setAccess] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedWorkspaceId, setSelectedWorkspaceIdState] = useState(PORTFOLIO);

  useEffect(() => {
    let active = true;
    async function load() {
      if (authLoading) return;
      if (!profile) {
        if (active) {
          setAccess(null);
          setSelectedWorkspaceIdState(PORTFOLIO);
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      setError("");
      try {
        const response = await api.get("/access/me");
        if (!active) return;
        const next = response.data;
        setAccess(next);
        const saved = window.localStorage.getItem(`tripdash:workspace:${profile.id}`) || PORTFOLIO;
        const allowed = new Set((next.workspaces || []).map((item) => item.schoolId));
        setSelectedWorkspaceIdState(saved === PORTFOLIO || allowed.has(saved) ? saved : PORTFOLIO);
      } catch (requestError) {
        if (!active) return;
        setAccess(null);
        setError(requestError?.response?.data?.message || "Unable to load your workspace access.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [profile?.id, authLoading]);

  const workspaces = access?.workspaces || [];
  const selectedWorkspace = selectedWorkspaceId === PORTFOLIO
    ? null
    : workspaces.find((item) => item.schoolId === selectedWorkspaceId) || null;

  function selectWorkspace(value) {
    const next = value || PORTFOLIO;
    if (next !== PORTFOLIO && !workspaces.some((item) => item.schoolId === next)) return false;
    setSelectedWorkspaceIdState(next);
    if (profile?.id) window.localStorage.setItem(`tripdash:workspace:${profile.id}`, next);
    return true;
  }

  const permissions = selectedWorkspace
    ? selectedWorkspace.permissions || []
    : access?.permissions || [];

  const value = useMemo(() => ({
    access,
    loading: authLoading || loading,
    error,
    workspaces,
    organizations: access?.organizations || [],
    roles: access?.roles || [],
    permissions,
    selectedWorkspaceId,
    selectedWorkspace,
    isPortfolio: selectedWorkspaceId === PORTFOLIO,
    portfolioEnabled: Boolean(access?.portfolio?.enabled),
    selectWorkspace,
    can: (permission) => permissions.includes(permission),
    canInWorkspace: (schoolId, permission) => {
      const workspace = workspaces.find((item) => item.schoolId === schoolId);
      return Boolean(workspace?.permissions?.includes(permission));
    },
  }), [access, authLoading, loading, error, workspaces, permissions, selectedWorkspaceId, selectedWorkspace]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return context;
}
