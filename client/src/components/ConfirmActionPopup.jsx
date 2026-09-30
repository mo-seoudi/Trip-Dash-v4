import React from "react";
import ConfirmDialog from "./ui/ConfirmDialog";

const ConfirmActionPopup = ({ title, description, onConfirm, onClose, confirmLabel = "Confirm", tone = "default" }) => (
  <ConfirmDialog
    title={title}
    description={description}
    confirmLabel={confirmLabel}
    tone={tone}
    onConfirm={onConfirm}
    onClose={onClose}
  />
);

export default ConfirmActionPopup;
