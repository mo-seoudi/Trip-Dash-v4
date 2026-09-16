// client/src/auth/msal.js
import { PublicClientApplication, EventType } from "@azure/msal-browser";

const clientId = import.meta.env.VITE_MSAL_CLIENT_ID;
const tenant = import.meta.env.VITE_MS_TENANT_ID || "common";

export const msalInstance = new PublicClientApplication({
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenant}`,
    redirectUri: "/",
  },
  cache: { cacheLocation: "localStorage" },
});

msalInstance.addEventCallback((event) => {
  if (event.eventType === EventType.LOGIN_SUCCESS && event.payload?.account) {
    msalInstance.setActiveAccount(event.payload.account);
  }
});
