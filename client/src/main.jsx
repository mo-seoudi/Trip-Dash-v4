// client/src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

import "./index.css";

// ✅ MSAL provider (Microsoft 365 auth for the SPA)
import { MsalProvider } from "@azure/msal-react";
import { msalInstance } from "./auth/msal"; // make sure this file exists as we set earlier

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <MsalProvider instance={msalInstance}>
      <App />
    </MsalProvider>
  </React.StrictMode>
);
