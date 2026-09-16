// client/src/services/microsoftService.js
import { msalInstance } from "../auth/msal.js";
import api from "./apiClient.js";

function apiScope() {
  const configured = String(import.meta.env.VITE_MS_API_SCOPE || "").trim();
  if (!configured) {
    throw new Error("Microsoft integration is not configured");
  }
  return configured;
}

async function acquireMicrosoftApiToken() {
  const accounts = msalInstance.getAllAccounts();
  const account = msalInstance.getActiveAccount() || accounts[0];
  if (!account) {
    throw new Error("Connect your Microsoft 365 account first");
  }

  const request = { account, scopes: [apiScope()] };
  try {
    const result = await msalInstance.acquireTokenSilent(request);
    return result.accessToken;
  } catch {
    const result = await msalInstance.acquireTokenPopup(request);
    return result.accessToken;
  }
}

async function microsoftRequest(config) {
  const microsoftAccessToken = await acquireMicrosoftApiToken();
  return api.request({
    ...config,
    headers: {
      ...(config.headers || {}),
      "X-Microsoft-Access-Token": microsoftAccessToken,
    },
  });
}

export async function getMicrosoftProfile() {
  const { data } = await microsoftRequest({ method: "get", url: "/ms/me" });
  return data;
}

export async function sendMicrosoftMail(payload) {
  const { data } = await microsoftRequest({ method: "post", url: "/ms/sendMail", data: payload });
  return data;
}

export async function createMicrosoftEvent(payload) {
  const { data } = await microsoftRequest({ method: "post", url: "/ms/events", data: payload });
  return data;
}
