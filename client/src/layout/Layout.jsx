import React, { useEffect, useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";

const Layout = () => {
  const { profile, logout, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!loading && !profile) {
      navigate("/login");
    }
  }, [loading, profile, navigate]);

  if (loading || !profile) {
    return <div className="p-6">Loading dashboard...</div>;
  }

  const renderBreadcrumbs = () => {
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

      <div className="flex flex-col flex-1">
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} profile={profile} />

        <main className="flex-grow px-6 py-4 overflow-y-scroll scrollbar-hide">
          <div className="text-sm mb-4 opacity-70 flex flex-wrap items-center gap-1">
            {renderBreadcrumbs()}
          </div>

          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
