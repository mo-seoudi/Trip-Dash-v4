import { oboAcquire, graphPost } from "../ms/graphOnBehalf.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeMailRecipients(to) {
  const recipients = (Array.isArray(to) ? to : [to])
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

export async function sendMicrosoftMailOnBehalf(userAssertion, message) {
  if (!userAssertion) {
    const error = new Error("Microsoft delegated access token is required");
    error.status = 401;
    throw error;
  }
  const subject = String(message?.subject || "").trim();
  const html = message?.html == null ? "" : String(message.html);
  const text = message?.text == null ? "" : String(message.text);
  if (!subject) {
    const error = new Error("Email subject is required");
    error.status = 400;
    throw error;
  }
  if (!html && !text) {
    const error = new Error("Email content is required");
    error.status = 400;
    throw error;
  }

  const graphToken = await oboAcquire(["https://graph.microsoft.com/Mail.Send"], userAssertion);
  await graphPost("/me/sendMail", graphToken, {
    message: {
      subject,
      body: { contentType: html ? "HTML" : "Text", content: html || text },
      toRecipients: normalizeMailRecipients(message.to).map((address) => ({ emailAddress: { address } })),
    },
    saveToSentItems: true,
  });
}
