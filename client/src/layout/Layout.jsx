import React, { useEffect, useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useWorkspace } from "../context/WorkspaceContext";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import api from "../services/apiClient";

const Layout = () => {
  const { profile, loading } = useAuth();
  const { switchingWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [organizationName, setOrganizationName] = useState("");

  const organizationMatch = location.pathname.match(/^\/admin\/organizations\/([^/]+)$/);
  const organizationId = organizationMatch?.[1] ? decodeURIComponent(organizationMatch[1]) : null;
  const showWorkspaceTransition = Boolean(switchingWorkspace && !location.pathname.startsWith("/admin"));

  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);
  useEffect(() => { if (!loading && !profile) navigate("/login"); }, [loading, profile, navigate]);
  useEffect(() => {
    let active = true;
    if (!organizationId) { setOrganizationName(""); return () => { active = false; }; }
    setOrganizationName("");
    api.get(`/platform-control/organizations/${encodeURIComponent(organizationId)}`).then((response) => { if (active) setOrganizationName(response.data?.organization?.display_name || "Organization"); }).catch(() => { if (active) setOrganizationName("Organization"); });
    return () => { active = false; };
  }, [organizationId]);

  if (loading || !profile) return <div className="p-6">Loading dashboard...</div>;

  const renderBreadcrumbs = () => {
    if (organizationId) return <><span>Admin</span><span>/</span><span>Organization</span><span>/</span><span className="font-medium text-gray-700">{organizationName || "Loading…"}</span></>;
    const segments = location.pathname.split("/").filter(Boolean);
    return segments.map((segment, idx) => <span key={idx} className="capitalize">{segment.replace(/-/g, " ")}{idx < segments.length - 1 ? " / " : ""}</span>);
  };

  return <div className="flex min-h-screen bg-gray-50 text-gray-800">
    <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
    <div className="flex flex-1 flex-col">
      <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} profile={profile} />
      <div className="relative flex flex-1 flex-col">
        <main className={`flex-grow overflow-y-scroll px-6 py-4 scrollbar-hide transition-[filter,opacity] duration-200 ${organizationId ? "organization-control-page" : ""} ${showWorkspaceTransition ? "pointer-events-none select-none opacity-70 blur-[0.4px]" : "opacity-100"}`}>
          <div className="mb-4 flex flex-wrap items-center gap-1 text-sm opacity-70">{renderBreadcrumbs()}</div>
          <Outlet />
        </main>
        <div aria-live="polite" aria-hidden={!showWorkspaceTransition} className={`absolute inset-0 z-40 flex items-center justify-center bg-gray-900/10 backdrop-blur-[1px] transition-opacity duration-200 ${showWorkspaceTransition ? "opacity-100" : "pointer-events-none opacity-0"}`}>
          {showWorkspaceTransition && <div className="flex items-center gap-3 rounded-xl border border-white/80 bg-white/95 px-4 py-3 shadow-lg shadow-gray-900/10">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-violet-200 border-t-violet-600" />
            <div><div className="text-sm font-semibold text-gray-800">Switching workspace</div><div className="text-xs text-gray-500">Opening {switchingWorkspace.to}</div></div>
          </div>}
        </div>
      </div>
    </div>
  </div>;
};

export default Layout;
