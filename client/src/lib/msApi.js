// client/src/lib/msApi.js
import { useMsal } from "@azure/msal-react";

const API_SCOPE = "api://YOUR_API_APP_ID/access_as_user";

export function useMsApi() {
  const { instance, accounts } = useMsal();
  const account = accounts[0];

  async function getApiToken() {
    const res = await instance.acquireTokenSilent({ scopes: [API_SCOPE], account });
    return res.accessToken;
  }

  return {
    async getMyMsProfile() {
      const at = await getApiToken();
      const r = await fetch("/api/ms/me", { headers: { Authorization: `Bearer ${at}` } });
      if (!r.ok) throw new Error("API /ms/me failed");
      return r.json();
    },
    async createOutlookEvent({ subject = "Trip demo", minutes = 60 } = {}) {
      const at = await getApiToken();
      const now = new Date();
      const end = new Date(now.getTime() + minutes * 60000);
      const payload = {
        subject,
        start: { dateTime: now.toISOString(), timeZone: "UTC" },
        end:   { dateTime: end.toISOString(), timeZone: "UTC" },
      };
      const r = await fetch("/api/ms/events", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${at}` },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error("API /ms/events failed");
      return r.json();
    },
  };
}
