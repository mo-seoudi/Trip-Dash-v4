import React from "react";

const variants = {
  primary: "bg-slate-900 text-white border-slate-900 hover:bg-slate-800",
  secondary: "bg-white text-slate-700 border-slate-200 hover:bg-slate-50",
  danger: "bg-red-600 text-white border-red-600 hover:bg-red-700",
  ghost: "bg-transparent text-slate-600 border-transparent hover:bg-slate-100",
};

export default function Button({ children, loading = false, disabled = false, variant = "primary", className = "", type = "button", ...props }) {
  const blocked = disabled || loading;
  return (
    <button
      type={type}
      disabled={blocked}
      aria-busy={loading || undefined}
      className={`inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-semibold shadow-sm transition focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant] || variants.primary} ${className}`}
      {...props}
    >
      {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden="true" />}
      {children}
    </button>
  );
}
