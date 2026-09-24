import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import api from "../services/apiClient";
import { useAuth } from "./AuthContext";

const WorkspaceContext = createContext(null);

export function WorkspaceProvider({ children }) {
  const { profile, loading: authLoading } = useAuth();
  const [access, setAccess] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedWorkspaceId, setSelectedWorkspaceIdState] = useState(null);
  const [workspaceEpoch, setWorkspaceEpoch] = useState(0);
  const [switchingWorkspace, setSwitchingWorkspace] = useState(null);

  useEffect(() => {
    let active = true;
    async function load() {
      if (authLoading) return;
      if (!profile) {
        if (active) {
          setAccess(null);
          setSelectedWorkspaceIdState(null);
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
        const nextWorkspaces = next.workspaces || [];
        setAccess(next);
        const saved = window.localStorage.getItem(`tripdash:workspace:${profile.id}`);
        const allowed = new Set(nextWorkspaces.map((item) => item.schoolId));
        const initial = saved && allowed.has(saved) ? saved : (nextWorkspaces[0]?.schoolId || null);
        setSelectedWorkspaceIdState(initial);
        if (initial) window.localStorage.setItem(`tripdash:workspace:${profile.id}`, initial);
      } catch (requestError) {
        if (!active) return;
        setAccess(null);
        setSelectedWorkspaceIdState(null);
        setError(requestError?.response?.data?.message || "Unable to load your workspace access.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [profile?.id, authLoading]);

  const workspaces = access?.workspaces || [];
  const selectedWorkspace = workspaces.find((item) => item.schoolId === selectedWorkspaceId) || null;

  function selectWorkspace(value) {
    const target = workspaces.find((item) => item.schoolId === value);
    if (!target) return false;
    if (value === selectedWorkspaceId) return true;
    setSwitchingWorkspace({ from: selectedWorkspace?.displayName || "current workspace", to: target.displayName });
    window.setTimeout(() => {
      setSelectedWorkspaceIdState(value);
      setWorkspaceEpoch((current) => current + 1);
      if (profile?.id) window.localStorage.setItem(`tripdash:workspace:${profile.id}`, value);
      window.setTimeout(() => setSwitchingWorkspace(null), 320);
    }, 220);
    return true;
  }

  const permissions = selectedWorkspace?.permissions || [];

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
    workspaceEpoch,
    switchingWorkspace,
    hasWorkspace: Boolean(selectedWorkspace),
    portfolioEnabled: Boolean(access?.portfolio?.enabled),
    selectWorkspace,
    can: (permission) => permissions.includes(permission),
    canInWorkspace: (schoolId, permission) => {
      const workspace = workspaces.find((item) => item.schoolId === schoolId);
      return Boolean(workspace?.permissions?.includes(permission));
    },
  }), [access, authLoading, loading, error, workspaces, permissions, selectedWorkspaceId, selectedWorkspace, workspaceEpoch, switchingWorkspace]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return context;
}
