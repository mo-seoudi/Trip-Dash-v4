import React from "react";
import ModalWrapper from "./ModalWrapper";

const ConfirmActionPopup = ({ title, description, onConfirm, onClose }) => {
  return (
    <ModalWrapper title={title} onClose={onClose} maxWidth="max-w-sm">
      <p className="text-gray-700 mb-6">{description}</p>
      <div className="flex gap-2">
        <button
          onClick={onClose}
          className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded transition"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition"
        >
          Confirm
        </button>
      </div>
    </ModalWrapper>
  );
};

export default ConfirmActionPopup;
