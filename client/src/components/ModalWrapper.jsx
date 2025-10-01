// client/src/components/ModalWrapper.jsx
import React, { useEffect } from "react";

const ModalWrapper = ({ title, onClose, children, maxWidth = "max-w-2xl" }) => {
  // Close with Esc key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`bg-white p-6 rounded-lg shadow-xl w-full ${maxWidth} relative max-h-[90vh] overflow-y-auto`}
      >
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-600 hover:text-red-500 text-2xl font-bold"
          aria-label="Close modal"
        >
          ×
        </button>
        {title && <h3 className="text-xl font-semibold mb-4">{title}</h3>}
        {children}
      </div>
    </div>
  );
};

export default ModalWrapper;
