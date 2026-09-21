import { Router } from "express";
import { requireApiToken } from "../ms/requireApiToken.js";
import { AUTH_COOKIE_NAME, authCookieOptions, signAuthToken } from "../lib/authTokens.js";
import { ensureMicrosoftIdentity, findMicrosoftUser, isActiveAppUser, normalizeEmail, primaryCanonicalRole, provisionMicrosoftUser, publicAppUser } from "../services/canonicalAuth.js";

const router = Router();

router.post("/login-microsoft", requireApiToken, async (req, res, next) => {
  try {
    const claims = req?.msal?.decoded || {};
    const email = normalizeEmail(claims.preferred_username || claims.upn || claims.email || (claims.unique_name?.includes("@") ? claims.unique_name : null));
    const subject = String(claims.oid || claims.sub || "").trim();
    if (!email) return res.status(400).json({ message: "No email claim found in Microsoft token." });

    let user = await findMicrosoftUser({ subject, email });
    const autoProvision = String(process.env.ALLOW_MS_AUTO_PROVISION || "false").toLowerCase() === "true";
    if (!user && !autoProvision) return res.status(403).json({ message: "No TripDash account exists for this Microsoft user." });

    if (!user) {
      user = await provisionMicrosoftUser({ subject, email, displayName: String(claims.name || email).trim().slice(0, 200) });
      return res.status(202).json({ ok: false, pendingApproval: true, message: "Account created and pending administrator approval." });
    }

    await ensureMicrosoftIdentity({ userId: user.id, subject, email });
    if (!isActiveAppUser(user)) return res.status(403).json({ message: "Account is not active.", status: user.status });

    const role = await primaryCanonicalRole(user.id);
    const responseUser = publicAppUser(user, role);
    const token = signAuthToken(responseUser);
    res.cookie(AUTH_COOKIE_NAME, token, authCookieOptions());
    return res.json({ ok: true, token, user: responseUser });
  } catch (error) { return next(error); }
});

export default router;
