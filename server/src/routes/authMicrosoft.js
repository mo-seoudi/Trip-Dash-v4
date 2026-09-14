// server/src/routes/authMicrosoft.js
import { Router } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";
import { requireApiToken } from "../ms/requireApiToken.js";
import { normalizeLegacyUser } from "../lib/legacyRoles.js";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error("JWT_SECRET is required but missing.");

function normalizeEmail(value) {
  return value ? String(value).trim().toLowerCase() : null;
}

function authCookieOptions() {
  const production = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    sameSite: production ? "none" : "lax",
    secure: production,
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

/**
 * POST /api/auth/login-microsoft
 * Requires an access token issued for the TripDash API.
 * Microsoft proves identity; TripDash remains authoritative for account status
 * and authorization.
 */
router.post("/login-microsoft", requireApiToken, async (req, res, next) => {
  try {
    const claims = req?.msal?.decoded || {};
    const email = normalizeEmail(
      claims.preferred_username ||
        claims.upn ||
        claims.email ||
        (claims.unique_name && claims.unique_name.includes("@") ? claims.unique_name : null)
    );

    if (!email) {
      return res.status(400).json({ message: "No email claim found in Microsoft token." });
    }

    let user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, role: true, status: true },
    });

    const autoProvision =
      String(process.env.ALLOW_MS_AUTO_PROVISION || "false").toLowerCase() === "true";

    if (!user && !autoProvision) {
      return res.status(403).json({
        message: "No TripDash account exists for this Microsoft user.",
      });
    }

    if (!user && autoProvision) {
      // Auto-provisioned accounts are deliberately not approved and therefore
      // receive no application session until an administrator activates them.
      user = await prisma.user.create({
        data: {
          email,
          name: String(claims.name || email).trim().slice(0, 200),
          role: "school_staff",
          status: "pending",
        },
        select: { id: true, email: true, name: true, role: true, status: true },
      });

      return res.status(202).json({
        ok: false,
        pendingApproval: true,
        message: "Account created and pending administrator approval.",
      });
    }

    if (String(user.status || "").toLowerCase().trim() !== "approved") {
      return res.status(403).json({
        message: "Account is not approved.",
        status: user.status,
      });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
    res.cookie("token", token, authCookieOptions());

    return res.json({ ok: true, token, user: normalizeLegacyUser(user) });
  } catch (e) {
    return next(e);
  }
});

export default router;
