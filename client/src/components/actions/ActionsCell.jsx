import React, { useState } from "react";
import { BsThreeDotsVertical } from "react-icons/bs";
import { FaEye, FaCheckCircle, FaTimesCircle, FaPlusCircle } from "react-icons/fa";

const ActionsCell = ({
  trip,
  role,
  onAccept,
  onReject,
  onAssign,
  onComplete,
  onEdit,
  onCancel,
  onView,
  mode = "both",
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const toggleDropdown = (e) => {
    e.stopPropagation();
    setDropdownOpen((prev) => !prev);
  };

  const closeDropdown = () => setDropdownOpen(false);

  // Only allow bus_company to see actions
  if (role !== "bus_company") {
    return (
      <button
        onClick={() => onView(trip)}
        title="View Trip Details"
        className="text-green-600 hover:text-green-800 flex items-center"
      >
        <FaEye size={14} className="mr-1" /> View
      </button>
    );
  }

  const statusActions = {
    Pending: [
      { label: "Accept", icon: FaCheckCircle, callback: onAccept, color: "hover:text-green-600" },
      { label: "Reject", icon: FaTimesCircle, callback: onReject, color: "hover:text-red-500" },
    ],
    Accepted: [
      { label: "Assign Bus", icon: FaPlusCircle, callback: onAssign, color: "hover:text-blue-600" },
    ],
    Confirmed: [
      { label: "Complete", icon: FaCheckCircle, callback: onComplete, color: "hover:text-green-600" },
    ],
  };

  const renderPrimary = () => {
    if (trip.status === "Canceled" || trip.status === "Rejected") {
      return (
        <div className="text-gray-400 text-s font-semibold flex items-center justify-center">
          <FaTimesCircle className="mr-1" />
        </div>
      );
    }

    if (trip.status === "Completed") {
      return (
        <div className="text-gray-400 text-s font-semibold flex items-center justify-start">
          <FaCheckCircle className="mr-1" />
        </div>
      );
    }

    const actionsForStatus = statusActions[trip.status];
    if (!actionsForStatus) return null;

    return (
      <div className="flex gap-4 w-full">
        {actionsForStatus.map(({ label, icon: Icon, callback, color }) => (
          <button
            key={label}
            onClick={() => callback(trip)}
            className={`text-gray-700 text-s font-semibold flex items-center justify-center transition-colors duration-200 ${color}`}
          >
            <Icon className="mr-1" /> {label}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div
      className={`flex items-center ${
        mode === "actions" ? "w-[150px]" : mode === "icons" ? "justify-center" : "w-full gap-2"
      }`}
    >
      {mode !== "icons" && <div className="flex flex-none w-full">{renderPrimary()}</div>}
      {mode !== "actions" && (
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => onView(trip)}
            title="View Trip Details"
            aria-label="View Trip"
            className="text-green-600 hover:text-green-800"
          >
            <FaEye size={14} />
          </button>
          <div className="relative">
            <button onClick={toggleDropdown} className="flex items-center" aria-label="More Options">
              <BsThreeDotsVertical className="text-gray-600 hover:text-gray-800" />
            </button>
            {dropdownOpen && (
              <div className="absolute right-0 z-20 mt-2 w-32 bg-white border rounded shadow-md text-xs">
                {trip.status !== "Canceled" && trip.status !== "Completed" && (
                  <>
                    <button
                      onClick={() => {
                        onEdit(trip);
                        closeDropdown();
                      }}
                      className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                    >
                      Edit Info
                    </button>
                    <button
                      onClick={() => {
                        onCancel(trip);
                        closeDropdown();
                      }}
                      className="block w-full text-left px-4 py-2 text-red-500 hover:bg-gray-100"
                    >
                      Cancel Trip
                    </button>
                  </>
                )}
                <button
                  onClick={() => {
                    onView(trip);
                    closeDropdown();
                  }}
                  className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                >
                  View
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ActionsCell;
