// server/src/ms/requireApiToken.js
import jwksClient from "jwks-rsa";
import jwt from "jsonwebtoken";

const jwks = jwksClient({
  jwksUri: "https://login.microsoftonline.com/common/discovery/v2.0/keys",
  cache: true,
  cacheMaxEntries: 5,
  cacheMaxAge: 10 * 60 * 1000,
  rateLimit: true,
  jwksRequestsPerMinute: 10,
});

function getKey(header, cb) {
  if (!header?.kid) return cb(new Error("Token has no key id"));
  jwks.getSigningKey(header.kid, (err, key) => {
    if (err) return cb(err);
    return cb(null, key.getPublicKey());
  });
}

function configuredTenant() {
  const tenant = String(process.env.MS_TENANT_ID || "").trim();
  return tenant && tenant.toLowerCase() !== "common" ? tenant : null;
}

function issuerAllowed(decoded) {
  const issuer = String(decoded?.iss || "");
  const tokenTenant = String(decoded?.tid || "");
  const tenant = configuredTenant();

  if (tenant && tokenTenant.toLowerCase() !== tenant.toLowerCase()) return false;

  if (tenant) {
    const expectedV2 = `https://login.microsoftonline.com/${tenant}/v2.0`;
    const expectedV1 = `https://sts.windows.net/${tenant}/`;
    return issuer === expectedV2 || issuer === expectedV1;
  }

  // Multi-tenant compatibility mode: require a concrete Microsoft tenant ID in
  // both the token and issuer rather than accepting an arbitrary matching URL.
  if (!tokenTenant) return false;
  return (
    issuer === `https://login.microsoftonline.com/${tokenTenant}/v2.0` ||
    issuer === `https://sts.windows.net/${tokenTenant}/`
  );
}

export function requireApiToken(req, res, next) {
  const expectedAudience = String(process.env.MS_EXPECTED_AUDIENCE || "").trim();
  if (!expectedAudience) {
    return res.status(503).json({ error: "Microsoft authentication is not configured" });
  }

  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  if (!token) return res.status(401).json({ error: "Missing bearer token" });

  jwt.verify(
    token,
    getKey,
    {
      algorithms: ["RS256"],
      audience: expectedAudience,
      clockTolerance: 5,
    },
    (err, decoded) => {
      if (err || !decoded || !issuerAllowed(decoded)) {
        return res.status(401).json({ error: "Invalid Microsoft access token" });
      }

      req.spaAccessToken = token;
      req.msal = { decoded };
      return next();
    }
  );
}
