// server/src/routes/ms.js
import { Router } from "express";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { requireApiToken } from "../ms/requireApiToken.js";
import { oboAcquire, graphGet, graphPost } from "../ms/graphOnBehalf.js";

const router = Router();

// Microsoft integration endpoints require two independent identities:
// 1) the approved TripDash application session (normal app Authorization), and
// 2) a Microsoft delegated API token in X-Microsoft-Access-Token.
router.use(requireAuth, requireApiToken);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanString(value, { max = 500, required = false, field = "value" } = {}) {
  if (value === undefined || value === null) {
    if (required) {
      const error = new Error(`${field} is required`);
      error.status = 400;
      throw error;
    }
    return null;
  }
  const result = String(value).trim();
  if (required && !result) {
    const error = new Error(`${field} is required`);
    error.status = 400;
    throw error;
  }
  if (result.length > max) {
    const error = new Error(`${field} is too long`);
    error.status = 400;
    throw error;
  }
  return result || null;
}

function parseDateTime(value, field) {
  const text = cleanString(value, { required: true, max: 100, field });
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    const error = new Error(`${field} must be a valid date/time`);
    error.status = 400;
    throw error;
  }
  return text;
}

function normalizeRecipients(to) {
  const source = Array.isArray(to) ? to : [to];
  const recipients = source
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean);

  if (!recipients.length || recipients.length > 50) {
    const error = new Error("Between 1 and 50 recipients are required");
    error.status = 400;
    throw error;
  }

  for (const address of recipients) {
    if (address.length > 254 || !EMAIL_RE.test(address)) {
      const error = new Error("One or more recipient email addresses are invalid");
      error.status = 400;
      throw error;
    }
  }
  return [...new Set(recipients)];
}

router.get("/me", async (req, res, next) => {
  try {
    const scopes = (process.env.MS_GRAPH_DEFAULT_SCOPES || "https://graph.microsoft.com/User.Read")
      .split(/\s+/)
      .filter(Boolean);
    const userToken = await oboAcquire(scopes, req.microsoftAccessToken);
    const me = await graphGet("/me", userToken);
    return res.json(me);
  } catch (e) {
    return next(e);
  }
});

router.post("/events", async (req, res, next) => {
  try {
    const input = req.body || {};
    const subject = cleanString(input.subject, { required: true, max: 255, field: "subject" });
    const startDateTime = parseDateTime(input.start?.dateTime, "start.dateTime");
    const endDateTime = parseDateTime(input.end?.dateTime, "end.dateTime");

    if (new Date(endDateTime) <= new Date(startDateTime)) {
      return res.status(400).json({ message: "end.dateTime must be after start.dateTime" });
    }

    const startTimeZone = cleanString(input.start?.timeZone, { max: 100, field: "start.timeZone" }) || "UTC";
    const endTimeZone = cleanString(input.end?.timeZone, { max: 100, field: "end.timeZone" }) || startTimeZone;
    const bodyContent = cleanString(input.body?.content, { max: 20_000, field: "body.content" });
    const bodyContentType = input.body?.contentType === "HTML" ? "HTML" : "Text";
    const locationName = cleanString(input.location?.displayName, { max: 500, field: "location.displayName" });

    const event = {
      subject,
      start: { dateTime: startDateTime, timeZone: startTimeZone },
      end: { dateTime: endDateTime, timeZone: endTimeZone },
      ...(bodyContent ? { body: { contentType: bodyContentType, content: bodyContent } } : {}),
      ...(locationName ? { location: { displayName: locationName } } : {}),
    };

    const graphToken = await oboAcquire(
      ["https://graph.microsoft.com/Calendars.ReadWrite"],
      req.microsoftAccessToken
    );
    const created = await graphPost("/me/events", graphToken, event);
    return res.status(201).json(created);
  } catch (e) {
    return next(e);
  }
});

router.post("/sendMail", async (req, res, next) => {
  try {
    const { to, html, text } = req.body || {};
    const recipients = normalizeRecipients(to);
    const subject = cleanString(req.body?.subject, { required: true, max: 255, field: "subject" });
    const htmlContent = cleanString(html, { max: 50_000, field: "html" });
    const textContent = cleanString(text, { max: 50_000, field: "text" });
    if (!htmlContent && !textContent) {
      return res.status(400).json({ message: "html or text content is required" });
    }

    const message = {
      message: {
        subject,
        body: {
          contentType: htmlContent ? "HTML" : "Text",
          content: htmlContent || textContent,
        },
        toRecipients: recipients.map((address) => ({ emailAddress: { address } })),
      },
      saveToSentItems: true,
    };

    const graphToken = await oboAcquire(
      ["https://graph.microsoft.com/Mail.Send"],
      req.microsoftAccessToken
    );
    await graphPost("/me/sendMail", graphToken, message);
    return res.status(202).json({ ok: true });
  } catch (e) {
    return next(e);
  }
});

router.get("/admin-consent-url", requireAdmin, (req, res) => {
  const clientId = process.env.MS_API_CLIENT_ID;
  const configuredRedirect = process.env.MS_ADMIN_CONSENT_REDIRECT_URI;
  if (!clientId || !configuredRedirect) {
    return res.status(503).json({ message: "Microsoft admin consent is not configured" });
  }

  if (req.query.redirect_uri && String(req.query.redirect_uri) !== configuredRedirect) {
    return res.status(400).json({ message: "redirect_uri is not allowed" });
  }

  const tenant = process.env.MS_TENANT_ID || "common";
  const params = new URLSearchParams({
    client_id: clientId,
    scope: ".default",
    redirect_uri: configuredRedirect,
  });
  const url = `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/v2.0/adminconsent?${params.toString()}`;
  return res.json({ url });
});

export default router;
