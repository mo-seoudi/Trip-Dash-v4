// client/src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

import "./index.css";

// ✅ MSAL provider (Microsoft 365 auth for the SPA)
import { MsalProvider } from "@azure/msal-react";
import { msalInstance } from "./auth/msal"; // make sure this file exists

const root = ReactDOM.createRoot(document.getElementById("root"));

const AppShell = (
  <MsalProvider instance={msalInstance}>
    <App />
  </MsalProvider>
);

root.render(
  import.meta.env.MODE === "development"
    ? <React.StrictMode>{AppShell}</React.StrictMode>
    : AppShell
);
