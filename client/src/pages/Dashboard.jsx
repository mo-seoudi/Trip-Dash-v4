// client/src/pages/Dashboard.jsx

import React from "react";
import { useAuth } from "../context/AuthContext";
import AdminUsers from "./AdminUsers";

const Dashboard = () => {
  const { profile } = useAuth();

  if (!profile) return <div className="p-6">Loading user...</div>;

  const { role, name } = profile;

  const renderDashboard = () => {
    switch (role) {
      case "admin":
        return (
          <div>
            <h2 className="text-2xl font-bold mb-4">Welcome, Admin {name}</h2>
            <p className="mb-4 text-gray-600">Manage users and permissions:</p>
            <AdminUsers />
          </div>
        );

      default:
        return (
          <div>
            <h2 className="text-2xl font-bold mb-4">Welcome, {name}</h2>
            <p className="text-gray-600">
              This is your dashboard. Features for your role will appear here soon.
            </p>
          </div>
        );
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {renderDashboard()}
    </div>
  );
};

export default Dashboard;
