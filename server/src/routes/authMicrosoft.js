// server/src/routes/authMicrosoft.js
import { Router } from "express";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { requireApiToken } from "../ms/requireApiToken.js";

const prisma = new PrismaClient();
const router = Router();

/**
 * POST /api/auth/login-microsoft
 * Requires: Authorization: Bearer <access_token for api://YOUR_API_APP_ID/access_as_user>
 * Behavior: verifies MS token, finds local user by email, issues app JWT cookie
 */
router.post("/login-microsoft", requireApiToken, async (req, res) => {
  try {
    // decoded Microsoft token claims (set by requireApiToken)
    const claims = req?.msal?.decoded || {};
    // Email can appear in several claims depending on tenant config
    const email =
      claims.preferred_username ||
      claims.upn ||
      claims.email ||
      (claims.unique_name && claims.unique_name.includes("@")
        ? claims.unique_name
        : null);

    if (!email) {
      return res.status(400).json({ message: "No email claim found in Microsoft token." });
    }

    // Find local user by email
    const user = await prisma.user.findUnique({
      where: { email: String(email).toLowerCase() },
      select: { id: true, email: true, name: true, role: true },
    });

    // Optionally auto-provision users if allowed
    const AUTOPROV = String(process.env.ALLOW_MS_AUTO_PROVISION || "false").toLowerCase() === "true";

    if (!user && !AUTOPROV) {
      return res.status(403).json({
        message: "No local account for this Microsoft user. Ask an admin to invite/register you.",
      });
    }

    let finalUser = user;

    if (!finalUser && AUTOPROV) {
      // Create a minimal account; you can expand this as needed
      finalUser = await prisma.user.create({
        data: {
          email: String(email).toLowerCase(),
          name: claims.name || email,
          role: "school_staff", // default role; adjust to your policy
        },
        select: { id: true, email: true, name: true, role: true },
      });
    }

    // Issue your app's JWT (same style as your normal login)
    const token = jwt.sign(
      { id: finalUser.id, email: finalUser.email, role: finalUser.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return res.json({ ok: true, user: finalUser });
  } catch (e) {
    console.error("login-microsoft error:", e);
    return res.status(500).json({ message: "Microsoft login failed." });
  }
});

export default router;
