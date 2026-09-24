import React, { useEffect, useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import api from "../services/apiClient";

const Layout = () => {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [organizationName, setOrganizationName] = useState("");

  const organizationMatch = location.pathname.match(/^\/admin\/organizations\/([^/]+)$/);
  const organizationId = organizationMatch?.[1] ? decodeURIComponent(organizationMatch[1]) : null;

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!loading && !profile) {
      navigate("/login");
    }
  }, [loading, profile, navigate]);

  useEffect(() => {
    let active = true;

    if (!organizationId) {
      setOrganizationName("");
      return () => {
        active = false;
      };
    }

    setOrganizationName("");
    api
      .get(`/platform-control/organizations/${encodeURIComponent(organizationId)}`)
      .then((response) => {
        if (active) {
          setOrganizationName(response.data?.organization?.display_name || "Organization");
        }
      })
      .catch(() => {
        if (active) setOrganizationName("Organization");
      });

    return () => {
      active = false;
    };
  }, [organizationId]);

  if (loading || !profile) {
    return <div className="p-6">Loading dashboard...</div>;
  }

  const renderBreadcrumbs = () => {
    if (organizationId) {
      return (
        <>
          <span>Admin</span>
          <span>/</span>
          <span>Organization</span>
          <span>/</span>
          <span className="font-medium text-gray-700">{organizationName || "Loading…"}</span>
        </>
      );
    }

    const segments = location.pathname.split("/").filter(Boolean);
    return segments.map((segment, idx) => (
      <span key={idx} className="capitalize">
        {segment.replace(/-/g, " ")}
        {idx < segments.length - 1 ? " / " : ""}
      </span>
    ));
  };

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-800">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div className="flex flex-1 flex-col">
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} profile={profile} />

        <main
          className={`flex-grow overflow-y-scroll px-6 py-4 scrollbar-hide ${
            organizationId ? "organization-control-page" : ""
          }`}
        >
          <div className="mb-4 flex flex-wrap items-center gap-1 text-sm opacity-70">
            {renderBreadcrumbs()}
          </div>

          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
