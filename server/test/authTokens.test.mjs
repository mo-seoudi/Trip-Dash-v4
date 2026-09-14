import test from "node:test";
import assert from "node:assert/strict";

// authTokens intentionally requires a configured signing secret at module load.
process.env.JWT_SECRET ||= "tripdash-test-secret-not-for-production";

const {
  AUTH_TOKEN_AUDIENCE,
  AUTH_TOKEN_ISSUER,
  readAuthToken,
  signAuthToken,
  verifyAuthToken,
} = await import("../src/lib/authTokens.js");

test("signed auth token contains identity but no authorization claims", () => {
  const token = signAuthToken({
    id: 42,
    email: "user@example.com",
    role: "admin",
    tenantId: "tenant-a",
  });
  const decoded = verifyAuthToken(token);

  assert.equal(decoded.sub, "42");
  assert.equal(decoded.id, 42);
  assert.equal(decoded.email, "user@example.com");
  assert.equal(decoded.iss, AUTH_TOKEN_ISSUER);
  assert.equal(decoded.aud, AUTH_TOKEN_AUDIENCE);
  assert.equal(decoded.role, undefined);
  assert.equal(decoded.tenantId, undefined);
});

test("bearer token takes precedence over cookie compatibility token", () => {
  const req = {
    headers: { authorization: "Bearer bearer-token" },
    cookies: { token: "cookie-token" },
  };
  assert.equal(readAuthToken(req), "bearer-token");
});

test("cookie token remains supported during the migration", () => {
  const req = { headers: {}, cookies: { token: "cookie-token" } };
  assert.equal(readAuthToken(req), "cookie-token");
});

test("verification rejects a token signed for the wrong audience", async () => {
  const jwt = (await import("jsonwebtoken")).default;
  const token = jwt.sign(
    { id: 42, email: "user@example.com" },
    process.env.JWT_SECRET,
    { issuer: AUTH_TOKEN_ISSUER, audience: "wrong-client", subject: "42", expiresIn: "1h" },
  );
  assert.throws(() => verifyAuthToken(token), /audience/i);
});
