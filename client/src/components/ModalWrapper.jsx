import React, { useEffect, useRef } from "react";

const ModalWrapper = ({ title, onClose, children, maxWidth = "max-w-2xl" }) => {
  const modalRef = useRef();

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  // Close on ESC key
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("keydown", handleEsc);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50 p-4">
      <div
        ref={modalRef}
        className={`bg-white p-6 rounded-lg shadow-xl w-full ${maxWidth} relative max-h-[90vh] overflow-y-auto`}
      >
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-600 hover:text-red-500 text-2xl font-bold"
          aria-label="Close Modal"
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
