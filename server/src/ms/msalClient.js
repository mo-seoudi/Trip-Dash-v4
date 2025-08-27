// server/src/ms/msalClient.js (ESM, lazy init)
import { ConfidentialClientApplication } from "@azure/msal-node";

let cachedCca = null;

function assertEnv(name, val) {
  if (!val || String(val).trim() === "") {
    throw new Error(`[MSAL config] Missing required env var: ${name}`);
  }
}

export function getCca() {
  if (cachedCca) return cachedCca;

  const clientId = process.env.MS_API_CLIENT_ID;
  const clientSecret = process.env.MS_API_CLIENT_SECRET;
  const tenant = process.env.MS_TENANT_ID || "common";

  assertEnv("MS_API_CLIENT_ID", clientId);
  assertEnv("MS_API_CLIENT_SECRET", clientSecret);

  cachedCca = new ConfidentialClientApplication({
    auth: {
      clientId,
      clientSecret,
      authority: `https://login.microsoftonline.com/${tenant}`,
    },
  });

  return cachedCca;
}
