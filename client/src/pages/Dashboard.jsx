// client/src/pages/Dashboard.jsx

import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import AdminUsers from "./AdminUsers";
import RequestTripButton from "../components/RequestTripButton"; // NEW

const Dashboard = () => {
  const { profile } = useAuth();

  // Keep the original state so we don't remove features
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  if (!profile) return <div className="p-6">Loading user...</div>;

  const { role, name } = profile;

  // Preserve the original handler (we no longer need to close local modal here,
  // but keeping the function avoids removing behavior other code might call)
  const handleTripAdded = () => {
    setShowForm(false);
  };

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

      case "school_staff":
        return (
          <>
            {/* Floating "Request New Trip +" button & modal (reusable) */}
            <RequestTripButton onSuccess={handleTripAdded} hidden={isEditing} />
          </>
        );

      case "bus_company":
        return (
          <div>
            <h2 className="text-2xl font-bold mb-4">Welcome, {name}</h2>
            <p className="text-gray-600 mb-6">
              Here you can manage trip requests, assign buses, and approve changes:
            </p>
          </div>
        );

      case "finance":
        return (
          <div>
            <h2 className="text-2xl font-bold mb-4">Welcome, {name}</h2>
            <p className="text-gray-600">Finance dashboard coming soon.</p>
          </div>
        );

      default:
        return <p>Role not recognized.</p>;
    }
  };

  return <div className="p-6 bg-gray-50 min-h-screen">{renderDashboard()}</div>;
};

export default Dashboard;
