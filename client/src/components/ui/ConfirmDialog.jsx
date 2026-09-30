import React, { useState } from "react";
import { FiAlertTriangle } from "react-icons/fi";
import ModalWrapper from "../ModalWrapper";
import Button from "./Button";

export default function ConfirmDialog({
  title = "Confirm action",
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  onConfirm,
  onClose,
}) {
  const [loading, setLoading] = useState(false);
  const destructive = tone === "danger";

  const confirm = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await onConfirm?.();
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalWrapper title={title} onClose={loading ? undefined : onClose} closeOnBackdrop={!loading} maxWidth="max-w-md">
      <div className="px-6 py-5">
        <div className="flex items-start gap-3">
          {destructive && (
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
              <FiAlertTriangle size={17} />
            </div>
          )}
          <p className="text-sm leading-6 text-slate-600">{description}</p>
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4">
        <Button variant="secondary" onClick={onClose} disabled={loading}>{cancelLabel}</Button>
        <Button variant={destructive ? "danger" : "primary"} onClick={confirm} loading={loading}>{confirmLabel}</Button>
      </div>
    </ModalWrapper>
  );
}
