import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is required but missing.");
}

export const AUTH_COOKIE_NAME = "token";
export const AUTH_TOKEN_ISSUER = "tripdash-api";
export const AUTH_TOKEN_AUDIENCE = "tripdash-web";
export const AUTH_TOKEN_TTL = "7d";
export const AUTH_COOKIE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;

export function authCookieOptions() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/",
    maxAge: AUTH_COOKIE_MAX_AGE_MS,
  };
}

export function authCookieClearOptions() {
  const { maxAge, ...options } = authCookieOptions();
  return options;
}

export function signAuthToken(user) {
  if (!user?.id || !user?.email) {
    throw new Error("Cannot sign auth token without user id and email");
  }

  // Authorization claims such as role/organization are deliberately excluded.
  // Current authorization data is loaded from PostgreSQL for each request.
  return jwt.sign(
    { id: user.id, email: user.email },
    JWT_SECRET,
    {
      expiresIn: AUTH_TOKEN_TTL,
      issuer: AUTH_TOKEN_ISSUER,
      audience: AUTH_TOKEN_AUDIENCE,
      subject: String(user.id),
    }
  );
}

export function verifyAuthToken(token) {
  return jwt.verify(token, JWT_SECRET, {
    issuer: AUTH_TOKEN_ISSUER,
    audience: AUTH_TOKEN_AUDIENCE,
  });
}

export function readAuthToken(req) {
  const bearer = req.headers.authorization || "";
  if (bearer.startsWith("Bearer ")) return bearer.slice(7).trim();
  return req.cookies?.[AUTH_COOKIE_NAME] || null;
}
