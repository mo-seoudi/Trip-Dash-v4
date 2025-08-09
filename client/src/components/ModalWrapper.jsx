import React from "react";

const ModalWrapper = ({ title, onClose, children, maxWidth = "max-w-2xl" }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50 p-4">
      <div
        className={`bg-white p-6 rounded-lg shadow-xl w-full ${maxWidth} relative max-h-[90vh] overflow-y-auto`}
      >
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-600 hover:text-red-500 text-2xl font-bold"
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
