// client/src/pages/Dashboard.jsx


import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import AdminUsers from "./AdminUsers";
import TripForm from "../components/TripForm";

const Dashboard = () => {
  const { profile } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(false);

  if (!profile) return <div className="p-6">Loading user...</div>;

  const { role, name } = profile;

  const handleTripAdded = () => {
    setShowForm(false);
    setRefreshTrigger((prev) => !prev);
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
          <div className="relative">
            <div className="mb-10">
              <h3 className="text-2xl font-bold mb-12">My Trip Requests</h3>
              <StaffTripList setIsEditing={setIsEditing} refreshTrigger={refreshTrigger} />
            </div>

            {!showForm && !isEditing && (
              <div
                className="fixed bottom-6 right-6 z-50 flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg hover:bg-blue-700 cursor-pointer"
                onClick={() => setShowForm(true)}
              >
                <span className="font-medium hidden sm:inline">Request New Trip</span>
                <span className="text-2xl">+</span>
              </div>
            )}

            {showForm && (
              <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-40 p-4">
                <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-xl relative max-h-[90vh] overflow-y-auto">
                  <button
                    onClick={() => setShowForm(false)}
                    className="absolute top-2 right-2 text-gray-600 hover:text-red-500 text-2xl font-bold"
                  >
                    ×
                  </button>
                  <TripForm onSuccess={handleTripAdded} onClose={() => setShowForm(false)} />
                </div>
              </div>
            )}
          </div>
        );

      case "bus_company":
        return (
          <div>
            <h2 className="text-2xl font-bold mb-4">Welcome, {name}</h2>
            <p className="text-gray-600 mb-6">Here you can manage trip requests, assign buses, and approve changes:</p>
            <BusTripList />
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

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {renderDashboard()}
    </div>
  );
};

export default Dashboard;
