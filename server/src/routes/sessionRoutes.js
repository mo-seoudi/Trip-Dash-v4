import express from "express";

import { prismaGlobal } from "../lib/prismaGlobal.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

async function findGlobalUser(appUser) {
  return (
    (await prismaGlobal.user.findFirst({ where: { legacyUserId: Number(appUser.id) }, select: { id: true } })) ||
    (await prismaGlobal.user.findFirst({ where: { email: appUser.email }, select: { id: true } }))
  );
}

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const appUser = req.user;
    const gUser = await findGlobalUser(appUser);
    const roles = gUser ? await prismaGlobal.userOrgMembership.findMany({
      where: { userId: gUser.id },
      include: { org: { select: { id: true, name: true, type: true } } },
      orderBy: { orgId: "asc" },
    }) : [];

    return res.json({
      user: { id: appUser.id, email: appUser.email, name: appUser.name, role: appUser.role },
      orgs: roles.map((r) => ({
        org_id: r.orgId,
        name: r.org?.name || r.orgId,
        type: r.org?.type === "bus_company" ? "bus_operator" : r.org?.type || null,
        role: r.role === "bus_company" ? "bus_operator" : r.role,
      })),
      active_org_id: req.cookies?.td_active_org || null,
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/session/set-org", requireAuth, async (req, res, next) => {
  try {
    const { org_id } = req.body || {};
    if (!org_id || typeof org_id !== "string" || org_id.length > 100) {
      return res.status(400).json({ message: "valid org_id required" });
    }

    const gUser = await findGlobalUser(req.user);
    if (!gUser) return res.status(403).json({ message: "No global user" });

    const membership = await prismaGlobal.userOrgMembership.findFirst({
      where: { userId: gUser.id, orgId: org_id },
      select: { userId: true, orgId: true, status: true },
    });
    if (!membership || !["active", "approved"].includes(String(membership.status).toLowerCase())) {
      return res.status(403).json({ message: "No active membership in this organization" });
    }

    const isProd = process.env.NODE_ENV === "production";
    res.cookie("td_active_org", org_id, {
      httpOnly: true,
      sameSite: isProd ? "none" : "lax",
      secure: isProd,
      path: "/",
    });
    return res.sendStatus(204);
  } catch (error) {
    return next(error);
  }
});

export default router;
