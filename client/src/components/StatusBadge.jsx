import React from "react";

const StatusBadge = ({ status }) => {
  let colorClass = "bg-gray-500";
  if (status === "Pending") colorClass = "bg-yellow-400";
  else if (status === "Accepted") colorClass = "bg-blue-500";
  else if (status === "Confirmed") colorClass = "bg-green-500";
  else if (status === "Rejected") colorClass = "bg-red-500";
  else if (status === "Completed") colorClass = "bg-green-800";

  return (
    <span className="flex items-center">
      <span
        className={`inline-block w-3 h-3 rounded-full mr-1 ${colorClass}`}
      ></span>
      <span className="text-gray-800">{status}</span>
    </span>
  );
};

export default StatusBadge;
