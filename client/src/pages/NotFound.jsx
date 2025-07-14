import React from "react";
import { Link } from "react-router-dom";

function NotFound() {
  return (
    <div className="h-screen flex items-center justify-center flex-col space-y-4 bg-gray-100">
      <h1 className="text-4xl font-bold text-gray-700">404 - Page Not Found</h1>
      <p className="text-gray-500">Oops! That page doesn’t exist.</p>
      <Link to="/" className="text-blue-600 hover:underline">
        Go back to dashboard
      </Link>
    </div>
  );
}

export default NotFound;
