// server/src/ms/graphOnBehalf.js
const fetch = require("node-fetch");
const { cca } = require("./msalClient");

async function oboAcquire(scopes, userAssertion) {
  const result = await cca.acquireTokenOnBehalfOf({
    oboAssertion: userAssertion,
    scopes,
  });
  return result.accessToken;
}

async function graphGet(path, bearer) {
  const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    headers: { Authorization: `Bearer ${bearer}` }
  });
  if (!res.ok) throw new Error(`Graph GET ${path} failed: ${res.status}`);
  return res.json();
}

module.exports = { oboAcquire, graphGet };
