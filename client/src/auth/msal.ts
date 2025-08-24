// client/src/auth/msal.ts

import { PublicClientApplication, EventType } from "@azure/msal-browser";

export const msalInstance = new PublicClientApplication({
  auth: {
    clientId: import.meta.env.VITE_MSAL_CLIENT_ID!,            // <-- SPA App (Entra) ID
    authority: "https://login.microsoftonline.com/common",     // multi-tenant
    redirectUri: "/",                                          // or your route
  },
  cache: { cacheLocation: "localStorage" }
});

// (nice-to-have) log when user signs in
msalInstance.addEventCallback((e) => {
  if (e.eventType === EventType.LOGIN_SUCCESS) {
    console.log("MSAL login success", e);
  }
});
