// client/src/components/RequestTripButton.jsx

import React, { useState } from "react";
import TripForm from "./TripForm";
import ModalWrapper from "./ModalWrapper";

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

      {/* Modal (now using ModalWrapper so ESC works) */}
      {open && (
        <ModalWrapper onClose={() => setOpen(false)}>
          <TripForm
            onSuccess={() => {
              setOpen(false);
              onSuccess && onSuccess();
            }}
            onClose={() => setOpen(false)}
          />
        </ModalWrapper>
      )}
    </>
  );
}
