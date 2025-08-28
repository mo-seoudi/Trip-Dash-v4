// server/src/routes/ms.js
import { Router } from "express";
import { requireApiToken } from "../ms/requireApiToken.js";
import { oboAcquire, graphGet, graphPost } from "../ms/graphOnBehalf.js";

const router = Router();
router.use(requireApiToken);

/**
 * GET /api/ms/me
 * Proof of OBO: calls Graph /me with delegated token
 */
router.get("/me", async (req, res) => {
  try {
    const scopes = (process.env.MS_GRAPH_DEFAULT_SCOPES || "https://graph.microsoft.com/User.Read").split(" ");
    const userToken = await oboAcquire(scopes, req.spaAccessToken);
    const me = await graphGet("/me", userToken);
    res.json(me);
  } catch (e) {
    res.status(500).json({ error: "Graph /me failed", details: e?.message || String(e) });
  }
});

/**
 * POST /api/ms/events
 * Creates an Outlook calendar event for the signed-in user
 * Body: { subject, start: {dateTime, timeZone}, end: {dateTime, timeZone}, ... }
 * Requires: Calendars.ReadWrite
 */
router.post("/events", async (req, res) => {
  try {
    const body = req.body || {};
    if (!body?.start?.dateTime || !body?.end?.dateTime) {
      return res.status(400).json({ error: "start.dateTime and end.dateTime are required" });
    }
    // Default timeZone to UTC if not provided
    body.start.timeZone = body.start.timeZone || "UTC";
    body.end.timeZone = body.end.timeZone || "UTC";

    const graphToken = await oboAcquire(
      ["https://graph.microsoft.com/Calendars.ReadWrite"],
      req.spaAccessToken
    );
    const created = await graphPost("/me/events", graphToken, body);
    res.json(created);
  } catch (e) {
    res.status(500).json({ error: "Create event failed", details: e?.message || String(e) });
  }
});

/**
 * POST /api/ms/sendMail
 * Sends an email as the signed-in user
 * Body: { to: string|array, subject: string, html?: string, text?: string }
 * Requires: Mail.Send
 */
router.post("/sendMail", async (req, res) => {
  try {
    const { to, subject, html, text } = req.body || {};
    if (!to || !subject || (!html && !text)) {
      return res.status(400).json({ error: "to, subject, and (html or text) are required" });
    }
    const recipients = Array.isArray(to) ? to : [to];

    const message = {
      message: {
        subject,
        body: { contentType: html ? "HTML" : "Text", content: html || text },
        toRecipients: recipients.map((addr) => ({ emailAddress: { address: String(addr) } })),
      },
      saveToSentItems: true,
    };

    const graphToken = await oboAcquire(["https://graph.microsoft.com/Mail.Send"], req.spaAccessToken);
    const result = await graphPost("/me/sendMail", graphToken, message);
    // /sendMail returns 202 with empty body when OK; our helper parses safely.
    res.status(202).json({ ok: true, result });
  } catch (e) {
    res.status(500).json({ error: "Send mail failed", details: e?.message || String(e) });
  }
});

/**
 * GET /api/ms/admin-consent-url
 * Builds an admin consent URL so a tenant admin can pre-approve permissions.
 * Query: ?redirect_uri=<your_app_url_after_consent>
 * Notes: This uses your API app ID (confidential client).
 */
router.get("/admin-consent-url", (req, res) => {
  try {
    const clientId = process.env.MS_API_CLIENT_ID;
    const redirectUri = encodeURIComponent(
      req.query.redirect_uri ||
      process.env.MS_ADMIN_CONSENT_REDIRECT_URI ||
      "https://example.com/consent-complete"
    );
    if (!clientId) {
      return res.status(500).json({ error: "Missing MS_API_CLIENT_ID" });
    }
    // common works for multi-tenant; you can swap to a specific tenant id if you only support one
    const tenant = process.env.MS_TENANT_ID || "common";
    const url =
      `https://login.microsoftonline.com/${tenant}/v2.0/adminconsent` +
      `?client_id=${clientId}&scope=.default&redirect_uri=${redirectUri}&state=ms-consent`;
    res.json({ url });
  } catch (e) {
    res.status(500).json({ error: "Failed to build admin consent URL", details: e?.message || String(e) });
  }
});

export default router;

