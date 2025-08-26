// server/src/ms/graphOnBehalf.js
import fetch from "node-fetch";
import { cca } from "./msalClient.js";

/**
 * Exchange the SPA's API token for a Microsoft Graph token (On-Behalf-Of)
 * @param {string[]} scopes e.g. ["https://graph.microsoft.com/User.Read"]
 * @param {string} userAssertion incoming bearer token from the SPA (for your API)
 * @returns {Promise<string>} access token for Graph
 */
export async function oboAcquire(scopes, userAssertion) {
  const result = await cca.acquireTokenOnBehalfOf({
    oboAssertion: userAssertion,
    scopes,
  });
  return result.accessToken;
}

export async function graphGet(path, bearer) {
  const r = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    headers: { Authorization: `Bearer ${bearer}` },
  });
  if (!r.ok) throw new Error(`Graph GET ${path} failed: ${r.status}`);
  return r.json();
}

export async function graphPost(path, bearer, body) {
  const r = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${bearer}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Graph POST ${path} failed: ${r.status} ${text}`);
  return text ? JSON.parse(text) : {};
}

