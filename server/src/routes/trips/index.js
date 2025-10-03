// server/src/routes/trips/index.js

import express from "express";
import { PrismaClient } from "@prisma/client";
import { PrismaClient as PrismaGlobal } from "../../prisma-global/index.js";
import jwt from "jsonwebtoken";

const router = express.Router();
const prisma = new PrismaClient();
const prismaGlobal = new PrismaGlobal();

/** helper to decode the JWT your server set as cookie or Bearer */
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

/** Resolve current app user, global user, roles (and tenant) */
async function resolveContext(req) {
  const decoded = getDecodedUser(req);
  if (!decoded?.id) throw Object.assign(new Error("Not logged in"), { status: 401 });

  const appUser = await prisma.user.findUnique({
    where: { id: Number(decoded.id) },
    select: { id: true, email: true, name: true },
  });
  if (!appUser) throw Object.assign(new Error("User not found"), { status: 401 });

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

  if (!gUser) throw Object.assign(new Error("Global user not found"), { status: 403 });

  const roles = await prismaGlobal.userRoles.findMany({
    where: { user_id: gUser.id },
    select: { role: true, org_id: true },
  });

  return { appUser, gUser, roles };
}

/**
 * GET /api/trips
 * Enforces visibility by role:
 * - school_staff: only my trips (createdById = me)
 * - bus company roles: trips for partnered schools within same tenant
 * - otherwise: tenant-fenced list
 */
router.get("/", async (req, res) => {
  try {
    const { appUser, gUser, roles } = await resolveContext(req);
    const roleSet = new Set(roles.map((r) => r.role));

    // Base where always tenant-fenced if you store tenant_id on Trip.
    // If you don't have Trip.tenant_id, remove that line.
    const where = { };

    // If your Trip table has tenant_id (from earlier steps), keep this:
    if ("tenant_id" in prisma.trip.fields) {
      where.tenant_id = gUser.tenant_id;
    }

    if (roleSet.has("school_staff")) {
      // show only trips the user requested
      where.createdById = appUser.id;
    } else if (
      roleSet.has("bus_company") ||
      roleSet.has("transport_officer") ||
      roleSet.has("bus_company_officer")
    ) {
      // determine which bus-company orgs this user belongs to
      const myBusCompanyOrgIds = roles.map((r) => r.org_id);

      // fetch partner school orgs for those companies in same tenant
      const partners = await prismaGlobal.partnerships.findMany({
        where: {
          tenant_id: gUser.tenant_id,
          bus_company_id: { in: myBusCompanyOrgIds },
        },
        select: { school_org_id: true },
      });

      const schoolOrgIds = partners.map((p) => p.school_org_id);

      // your Trip table must have school_org_id for this to work
      where.school_org_id = { in: schoolOrgIds.length ? schoolOrgIds : ["_none_"] };
    } else {
      // admins or other roles: stay tenant-fenced (already set)
    }

    // Optional: pagination
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
