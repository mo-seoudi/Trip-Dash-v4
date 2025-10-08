// client/src/components/RequestTripButton.jsx
import React, { useEffect, useRef, useState } from "react";
import TripForm from "./TripForm";

export default function RequestTripButton({ onSuccess, hidden = false }) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef(null);

  // Keep Esc-to-close + background scroll lock
  useEffect(() => {
    if (!open) return;

    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // focus dialog for a11y
    setTimeout(() => dialogRef.current?.focus(), 0);

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (hidden) return null;

  return (
    <>
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

      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex justify-center items-center p-4"
          // ⛔ No click-outside handler — users must use the close button or Esc
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="request-trip-title"
            tabIndex={-1}
            className="bg-white p-6 rounded-lg shadow-xl w-full max-w-xl relative max-h-[90vh] overflow-y-auto outline-none"
          >
            <button
              onClick={() => setOpen(false)}
              className="absolute top-2 right-2 text-gray-600 hover:text-red-500 text-2xl font-bold"
              aria-label="Close"
            >
              ×
            </button>

            <h2 id="request-trip-title" className="sr-only">
              Request New Trip
            </h2>

            <TripForm
              onSuccess={async () => {
                setOpen(false);
                if (onSuccess) await onSuccess();
              }}
              onClose={() => setOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
