// client/src/components/Sidebar.jsx
import React, { useRef, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { FiHome, FiList, FiDollarSign, FiSettings, FiTable } from "react-icons/fi";
import { useAuth } from "../context/AuthContext";

function Sidebar({ sidebarOpen, setSidebarOpen }) {
  const sidebar = useRef();
  const trigger = useRef();
  const { profile } = useAuth();
  const userRole = profile?.role;

  // navigation items
  const links = [
    { to: "/", label: "Dashboard", icon: <FiHome size={18} /> },
    { to: "/trips", label: "All Trips", icon: <FiList size={18} /> },
    ...(userRole === "admin" || userRole === "finance"
      ? [{ to: "/finance", label: "Finance", icon: <FiDollarSign size={18} /> }]
      : []),
    ...(userRole === "admin"
      ? [{ to: "/admin/global", label: "Global Admin", icon: <FiTable size={18} /> }]
      : []),
    { to: "/bookings", label: "Bus Bookings", icon: <FiList size={18} /> },
    { to: "/settings", label: "Settings", icon: <FiSettings size={18} /> },
  ];

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!sidebar.current || !trigger.current) return;
      if (!sidebarOpen) return;
      if (sidebar.current.contains(e.target)) return;
      if (trigger.current.contains(e.target)) return;
      setSidebarOpen(false);
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [sidebarOpen, setSidebarOpen]);

  useEffect(() => {
    const handleEsc = (e) => {
      if (!sidebarOpen || e.key !== "Escape") return;
      setSidebarOpen(false);
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [sidebarOpen, setSidebarOpen]);

  return (
    <>
      <div
        className={`fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300 ${
          sidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden="true"
      />
      <div
        ref={sidebar}
        className={`fixed inset-y-0 left-0 w-64 bg-white border-r shadow-xl overflow-y-auto transform z-50 transition-transform duration-300 ease-in-out
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0 lg:static lg:inset-0`}
      >
        <div className="flex justify-end p-4 lg:hidden">
          <button
            ref={trigger}
            onClick={() => setSidebarOpen(false)}
            className="text-gray-600 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        <div className="flex items-center justify-center py-4 text-xl font-bold text-violet-600">
          School Trips
        </div>

        <nav className="px-4 space-y-1">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `flex items-center px-3 py-2 rounded transition-colors duration-200 ${
                  isActive
                    ? "bg-violet-100 text-violet-600 font-medium"
                    : "text-gray-700 hover:bg-gray-100 hover:text-violet-600"
                }`
              }
              onClick={() => setSidebarOpen(false)}
            >
              <span className="mr-3">{link.icon}</span>
              <span>{link.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </>
  );
}

export default Sidebar;
