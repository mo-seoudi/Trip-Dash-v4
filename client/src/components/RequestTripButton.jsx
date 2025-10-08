// client/src/components/RequestTripButton.jsx

import React, { useState } from "react";
import TripForm from "./TripForm";

export default function RequestTripButton({ onSuccess, hidden = false }) {
  const [open, setOpen] = useState(false);

  if (hidden) return null;

  return (
    <>
      {/* Floating Action Button */}
      {!open && (
        <button
          type="button"
          className="fixed bottom-6 right-6 z-50 flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          onClick={() => setOpen(true)}
          aria-label="Request New Trip"
        >
          <span className="font-medium hidden sm:inline">Request New Trip</span>
          <span className="text-2xl leading-none">+</span>
        </button>
      )}

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-40 p-4">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setOpen(false)}
              className="absolute top-2 right-2 text-gray-600 hover:text-red-500 text-2xl font-bold"
              aria-label="Close"
            >
              ×
            </button>
            <TripForm
              onSuccess={() => {
                setOpen(false);
                onSuccess && onSuccess();
              }}
              onClose={() => setOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
