import React from "react";

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="animate-spin rounded-full h-8 w-8 border-t-4 border-blue-500 border-solid" />
    </div>
  );
}

export default LoadingSpinner;
