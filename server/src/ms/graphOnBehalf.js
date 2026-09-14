// server/src/ms/graphOnBehalf.js
import fetch from "node-fetch";
import { getCca } from "./msalClient.js";

const GRAPH_ORIGIN = "https://graph.microsoft.com";
const GRAPH_VERSION = "v1.0";
const GRAPH_TIMEOUT_MS = 10_000;

function assertGraphPath(path) {
  const value = String(path || "");
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    throw new Error("Invalid Microsoft Graph path");
  }
  return value;
}

async function graphFetch(path, bearer, options = {}) {
  const safePath = assertGraphPath(path);
  if (!bearer) throw new Error("Missing Microsoft Graph access token");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GRAPH_TIMEOUT_MS);
  try {
    return await fetch(`${GRAPH_ORIGIN}/${GRAPH_VERSION}${safePath}`, {
      ...options,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${bearer}`,
        ...(options.headers || {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function oboAcquire(scopes, userAssertion) {
  if (!userAssertion) throw new Error("Missing Microsoft user assertion");
  if (!Array.isArray(scopes) || !scopes.length) throw new Error("Microsoft Graph scopes are required");

  const cca = getCca();
  const result = await cca.acquireTokenOnBehalfOf({
    oboAssertion: userAssertion,
    scopes,
  });
  if (!result?.accessToken) throw new Error("Microsoft OBO token acquisition returned no access token");
  return result.accessToken;
}

export async function graphGet(path, bearer) {
  const response = await graphFetch(path, bearer);
  if (!response.ok) throw new Error(`Microsoft Graph GET failed with status ${response.status}`);
  return response.json();
}

export async function graphPost(path, bearer, body) {
  const response = await graphFetch(path, bearer, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) {
    // Do not copy Microsoft response bodies into application errors/logs: they
    // can contain user or tenant data that should not leak through our API.
    throw new Error(`Microsoft Graph POST failed with status ${response.status}`);
  }
  return text ? JSON.parse(text) : {};
}
