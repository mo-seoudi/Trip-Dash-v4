import React from "react";
import { BiSearchAlt2 } from "react-icons/bi";
import { Listbox } from "@headlessui/react";
import { SlRefresh } from "react-icons/sl";
import { FiDownload } from "react-icons/fi";
import { exportToCSV } from "../utils/exportToCSV";

const TripFilters = ({
  search,
  setSearch,
  monthFilter,
  setMonthFilter,
  monthOptions,
  statusFilter,
  setStatusFilter,
  statusOptions,
  onReset,
  filteredData
}) => {
  return (
    <div className="flex flex-wrap gap-2 items-center">
      {/* Search input */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search destination, notes, or type"
          className="pl-9 pr-3 py-2 border rounded w-64 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <BiSearchAlt2 className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
      </div>

      
      {/* Month filter */}
      <Listbox value={monthFilter} onChange={setMonthFilter}>
        <div className="relative w-40">
          <Listbox.Button className="border px-3 py-2 rounded text-sm w-full text-left">
            {monthFilter || "Month"}
          </Listbox.Button>
          <Listbox.Options className="absolute mt-1 w-full bg-white border rounded shadow-lg z-50 max-h-60 overflow-auto">
            {monthOptions.map((month) => (
              <Listbox.Option
                key={month}
                value={month}
                className={({ active }) =>
                  `cursor-pointer select-none px-4 py-2 text-sm ${
                    active ? "bg-gray-100" : ""
                  }`
                }
              >
                {month}
              </Listbox.Option>
            ))}
          </Listbox.Options>
        </div>
      </Listbox>
{/* Status filter */}
      <Listbox value={statusFilter} onChange={setStatusFilter}>
        <div className="relative w-32">
          <Listbox.Button className="border px-3 py-2 rounded text-sm w-full text-left">
            {statusFilter || "Status"}
          </Listbox.Button>
          <Listbox.Options className="absolute mt-1 w-full bg-white border rounded shadow-lg z-50 max-h-60 overflow-auto">
            {statusOptions.map((status) => (
              <Listbox.Option
                key={status}
                value={status}
                className={({ active }) =>
                  `cursor-pointer select-none px-4 py-2 text-sm ${
                    active ? "bg-gray-100" : ""
                  }`
                }
              >
                <div className="flex items-center">
                  <span
                    className={`inline-block w-2 h-2 rounded-full mr-2 ${
                      status === "Pending"
                        ? "bg-yellow-500"
                        : status === "Accepted"
                        ? "bg-blue-500"
                        : status === "Confirmed"
                        ? "bg-green-500"
                        : status === "Completed"
                        ? "bg-gray-500"
                        : status === "Canceled"
                        ? "bg-gray-400"
                        : "bg-red-500"
                    }`}
                  ></span>
                  {status}
                </div>
              </Listbox.Option>
            ))}
          </Listbox.Options>
        </div>
      </Listbox>

      {/* Reset button */}
      <button
        onClick={onReset}
        className="text-gray-600 hover:text-blue-600 transition-colors"
        title="Reset filters"
      >
        <SlRefresh size={18} />
      </button>

      {/* Export button */}
      <button
        onClick={() => exportToCSV(filteredData, "trips")}
        disabled={!filteredData || filteredData.length === 0}
        className={`flex items-center gap-1 text-gray-600 transition-colors ${
          filteredData && filteredData.length > 0
            ? "hover:text-green-600"
            : "opacity-50 cursor-not-allowed"
        }`}
        title="Export to CSV"
      >
        <FiDownload size={18} />
      </button>
    </div>
  );
};

export default TripFilters;
