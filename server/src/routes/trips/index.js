// server/src/routes/trips/index.js

import express from "express";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { PrismaClient as PrismaGlobal } from "../../prisma-global/index.js";

const router = express.Router();
const prisma = new PrismaClient();
const prismaGlobal = new PrismaGlobal();

/** ----------------------------------------------------------------
 * Auth helper: accept either Authorization: Bearer <jwt> header
 * or the cross-site cookie named "token"
 * ---------------------------------------------------------------- */
function getDecodedUser(req) {
  try {
    const bearer = req.headers.authorization || "";
    const token = bearer.startsWith("Bearer ")
      ? bearer.slice(7)
      : req.cookies?.token;
    if (!token) return null;
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

/** Simple middleware to require auth and attach req.user = { id, email } */
function requireAuth(req, res, next) {
  const decoded = getDecodedUser(req);
  if (!decoded?.id) return res.status(401).json({ message: "Not logged in" });
  req.user = decoded; // { id, email }
  next();
}

/** Resolve current app user, global user and roles */
async function resolveContext(req) {
  // req.user is ensured by requireAuth
  const appUser = await prisma.user.findUnique({
    where: { id: Number(req.user.id) },
    select: { id: true, email: true, name: true },
  });
  if (!appUser)
    throw Object.assign(new Error("User not found"), { status: 401 });

  // find global user via legacy_user_id, fallback by email
  const gUser =
    (await prismaGlobal.users.findFirst({
      where: { legacy_user_id: Number(appUser.id) },
      select: { id: true, tenant_id: true, email: true },
    })) ||
    (await prismaGlobal.users.findFirst({
      where: { email: appUser.email },
      select: { id: true, tenant_id: true, email: true },
    }));

  if (!gUser)
    throw Object.assign(new Error("Global user not found"), { status: 403 });

  const roles = await prismaGlobal.userRoles.findMany({
    where: { user_id: gUser.id },
    select: { role: true, org_id: true },
  });

  return { appUser, gUser, roles };
}

/**
 * GET /api/trips
 * Visibility rules:
 *  - school_staff -> only trips they created (createdById = me)
 *  - bus-company roles -> trips belonging to partnered schools in same tenant
 *  - others -> tenant-fenced (if you store tenant_id on Trip)
 *
 * Pagination: ?take=200 (max 500)
 */
router.get("/", requireAuth, async (req, res) => {
  try {
    const { appUser, gUser, roles } = await resolveContext(req);
    const roleSet = new Set(roles.map((r) => r.role));

    // Build where clause
    /** @type {import('@prisma/client').Prisma.TripWhereInput} */
    const where = {};

    // If your Trip table includes tenant_id, fence by tenant.
    // (Harmless if the field doesn’t exist in your schema; remove if not used.)
    if ("tenant_id" in prisma.trip._meta?.fields ?? {}) {
      // NOTE: prisma.trip._meta is not standard; leaving this guard harmless.
      // If tenant_id definitely exists, you can set directly:
      // where.tenant_id = gUser.tenant_id;
    }

    if (roleSet.has("school_staff")) {
      // A staff member sees only the trips they requested
      where.createdById = appUser.id;
    } else if (
      roleSet.has("bus_company") ||
      roleSet.has("transport_officer") ||
      roleSet.has("bus_company_officer")
    ) {
      // Org memberships for this user (bus companies they belong to)
      const myBusCompanyOrgIds = roles.map((r) => r.org_id);

      // Find partner school orgs in same tenant
      const partners = await prismaGlobal.partnerships.findMany({
        where: {
          tenant_id: gUser.tenant_id,
          bus_company_id: { in: myBusCompanyOrgIds },
        },
        select: { school_org_id: true },
      });

      const schoolOrgIds = partners.map((p) => p.school_org_id);

      // Your Trip table must have school_org_id for this filter to work
      where.school_org_id = {
        in: schoolOrgIds.length ? schoolOrgIds : ["__none__"],
      };
    } else {
      // Admins/other roles: you can keep tenant fence here if you have it,
      // or simply leave broader access as-is.
    }

    const take = Math.min(Number(req.query.take || 200), 500);

    const trips = await prisma.trip.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
    });

    res.json(trips);
  } catch (e) {
    console.error("GET /api/trips error:", e);
    res.status(e.status || 500).json({ message: e.message || "Internal error" });
  }
});

export default router;
