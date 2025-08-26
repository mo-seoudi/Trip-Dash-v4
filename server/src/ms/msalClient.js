// server/src/ms/msalClient.js
const { ConfidentialClientApplication } = require("@azure/msal-node");

const cca = new ConfidentialClientApplication({
  auth: {
    clientId: process.env.MS_API_CLIENT_ID,
    clientSecret: process.env.MS_API_CLIENT_SECRET,
    authority: `https://login.microsoftonline.com/${process.env.MS_TENANT_ID || "common"}`,
  },
});

module.exports = { cca };
