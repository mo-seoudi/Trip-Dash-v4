import React, { useEffect, useId } from "react";
import { FiX } from "react-icons/fi";

const ModalWrapper = ({ title, description, onClose, children, maxWidth = "max-w-2xl", closeOnBackdrop = true }) => {
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[1px]"
      role="presentation"
      onMouseDown={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        className={`relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl ${maxWidth}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
      >
        {(title || description) && (
          <div className="border-b border-slate-100 px-6 py-5 pr-14">
            {title && <h2 id={titleId} className="text-lg font-semibold tracking-tight text-slate-950">{title}</h2>}
            {description && <p id={descriptionId} className="mt-1 text-sm leading-6 text-slate-500">{description}</p>}
          </div>
        )}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200"
          aria-label="Close dialog"
        >
          <FiX size={18} />
        </button>
        <div className="min-h-0 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

export default ModalWrapper;
