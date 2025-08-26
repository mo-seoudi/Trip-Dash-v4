// server/src/ms/msalClient.js
import { ConfidentialClientApplication } from "@azure/msal-node";

const clientId = process.env.MS_API_CLIENT_ID;
const clientSecret = process.env.MS_API_CLIENT_SECRET;
const tenant = process.env.MS_TENANT_ID || "common";

function assertEnv(name, val) {
  if (!val || String(val).trim() === "") {
    throw new Error(`[MSAL config] Missing required env var: ${name}`);
  }
}

assertEnv("MS_API_CLIENT_ID", clientId);
assertEnv("MS_API_CLIENT_SECRET", clientSecret);

export const cca = new ConfidentialClientApplication({
  auth: {
    clientId,
    clientSecret,
    authority: `https://login.microsoftonline.com/${tenant}`,
  },
});
