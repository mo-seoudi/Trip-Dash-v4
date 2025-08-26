// server/src/ms/requireApiToken.js
import jwksClient from "jwks-rsa";
import jwt from "jsonwebtoken";

// JWKS from the common endpoint (works for multi-tenant during development)
const client = jwksClient({
  jwksUri: "https://login.microsoftonline.com/common/discovery/v2.0/keys",
});

function getKey(header, cb) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return cb(err);
    const signingKey = key.getPublicKey();
    cb(null, signingKey);
  });
}

// Middleware: verifies the SPA's bearer token is meant for YOUR API.
// - Verifies signature via JWKS (RS256)
// - Checks 'aud' matches MS_EXPECTED_AUDIENCE (e.g., api://YOUR_API_APP_ID)
// - Light issuer pattern validation for Microsoft v2.0 endpoints
// - On success: attaches raw token to req.spaAccessToken
export async function requireApiToken(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing bearer token" });

  jwt.verify(
    token,
    getKey,
    { algorithms: ["RS256"], audience: process.env.MS_EXPECTED_AUDIENCE },
    (err, decoded) => {
      if (err) {
        return res
          .status(401)
          .json({ error: "Invalid token", details: err.message });
      }

      const iss = decoded && decoded.iss ? String(decoded.iss) : "";
      const okIssuer =
        /https:\/\/sts\.windows\.net\/[^/]+\/?/i.test(iss) ||
        /https:\/\/login\.microsoftonline\.com\/[^/]+\/v2\.0\/?/i.test(iss);

      if (!okIssuer) {
        return res.status(401).json({ error: "Invalid issuer", issuer: iss });
      }

      req.spaAccessToken = token;
      req.msal = { decoded };
      next();
    }
  );
}

