// client/src/auth/msal.js
import { PublicClientApplication, EventType } from "@azure/msal-browser";

export const msalInstance = new PublicClientApplication({
  auth: {
    clientId: import.meta.env.VITE_MSAL_CLIENT_ID, // no "!"
    authority: "https://login.microsoftonline.com/common",
    redirectUri: "/",
  },
  cache: { cacheLocation: "localStorage" }
});

msalInstance.addEventCallback((e) => {
  if (e.eventType === EventType.LOGIN_SUCCESS) {
    console.log("MSAL login success", e);
  }
});
