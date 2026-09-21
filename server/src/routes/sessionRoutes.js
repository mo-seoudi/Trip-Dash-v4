import express from "express";
import { prismaControl } from "../lib/prismaControl.js";
import { requireAuth } from "../middleware/auth.js";
import { resolveRuntimeAccess } from "../services/accessRuntime.js";

const router = express.Router();

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const access = await resolveRuntimeAccess({ user: req.user });
    return res.json({
      user: req.user,
      orgs: (access.organizations || []).map((org) => ({
        org_id: org.id,
        name: org.displayName,
        full_name: org.fullName,
        abbreviation: org.abbreviation,
        type: org.type,
      })),
      active_org_id: req.cookies?.td_active_org || null,
    });
  } catch (error) { return next(error); }
});

router.post("/session/set-org", requireAuth, async (req, res, next) => {
  try {
    const orgId = String(req.body?.org_id || "").trim();
    if (!orgId || orgId.length > 100) return res.status(400).json({ message: "valid org_id required" });

    const membership = await prismaControl.organizationMembership.findUnique({
      where: { userId_organizationId: { userId: req.user.id, organizationId: orgId } },
      select: { status: true },
    });
    if (!membership || membership.status !== "ACTIVE") return res.status(403).json({ message: "No active membership in this organization" });

    const isProd = process.env.NODE_ENV === "production";
    res.cookie("td_active_org", orgId, { httpOnly: true, sameSite: isProd ? "none" : "lax", secure: isProd, path: "/" });
    return res.sendStatus(204);
  } catch (error) { return next(error); }
});

export default router;
