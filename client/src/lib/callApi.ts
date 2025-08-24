// client/src/lib/callApi.ts

import { useMsal } from "@azure/msal-react";

export function useApi() {
  const { instance, accounts } = useMsal();
  const account = accounts[0];

  async function getBackendToken(scope: string) {
    const token = await instance.acquireTokenSilent({ scopes: [scope], account });
    return token.accessToken;
  }

  return {
    async getMyMsProfile() {
      const at = await getBackendToken("api://YOUR_API_APP_ID/access_as_user");
      const res = await fetch("/api/ms/me", { headers: { Authorization: `Bearer ${at}` } });
      return res.json();
    },
    async createOutlookEvent(payload: any) {
      const at = await getBackendToken("api://YOUR_API_APP_ID/access_as_user");
      const res = await fetch("/api/ms/events", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${at}` },
        body: JSON.stringify(payload),
      });
      return res.json();
    },
  };
}
