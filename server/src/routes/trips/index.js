// server/src/routes/trips/index.js

import express from "express";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { PrismaClient as PrismaGlobal } from "../../prisma-global/index.js";

const router = express.Router();
const prisma = new PrismaClient();
const prismaGlobal = new PrismaGlobal();

/* ---------------- Auth helpers ---------------- */
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

function requireAuth(req, res, next) {
  const decoded = getDecodedUser(req);
  if (!decoded?.id) return res.status(401).json({ message: "Not logged in" });
  req.user = decoded; // { id, email }
  next();
}

/* ------------- Context (app user, global user, roles) ------------- */
async function resolveContext(req) {
  const appUser = await prisma.user.findUnique({
    where: { id: Number(req.user.id) },
    select: { id: true, email: true, name: true },
  });
  if (!appUser)
    throw Object.assign(new Error("User not found"), { status: 401 });

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

/* ------------- Visibility builder (role-aware) ------------- */
async function buildTripsWhere({ appUser, gUser, roles, scope }) {
  const roleSet = new Set(roles.map((r) => r.role));

  /** @type {import('@prisma/client').Prisma.TripWhereInput} */
  const where = {};

  // If Trip has tenant_id and you want to fence by tenant, uncomment:
  // where.tenant_id = gUser.tenant_id;

  // force “mine” if explicitly requested
  if (scope === "mine") {
    where.createdById = appUser.id;
    return where;
  }

  if (roleSet.has("school_staff")) {
    // default for staff is “mine”
    where.createdById = appUser.id;
  } else if (
    roleSet.has("bus_company") ||
    roleSet.has("transport_officer") ||
    roleSet.has("bus_company_officer")
  ) {
    // orgs this user belongs to
    const myBusCompanyOrgIds = roles.map((r) => r.org_id);

    // partner school orgs within same tenant
    const partners = await prismaGlobal.partnerships.findMany({
      where: {
        tenant_id: gUser.tenant_id,
        bus_company_id: { in: myBusCompanyOrgIds },
      },
      select: { school_org_id: true },
    });

    const schoolOrgIds = partners.map((p) => p.school_org_id);

    // requires Trip.school_org_id
    where.school_org_id = {
      in: schoolOrgIds.length ? schoolOrgIds : ["__none__"],
    };
  } else {
    // admins/other roles → keep tenant fence if you enable it above
  }

  return where;
}

/* ------------- Core fetch function used by all endpoints ------------- */
async function fetchTrips(req, res) {
  try {
    const scope = (req.query.scope || "").toString().toLowerCase().trim();
    const { appUser, gUser, roles } = await resolveContext(req);
    const where = await buildTripsWhere({ appUser, gUser, roles, scope });

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
}

/* ---------------- Routes (backward compatible) ---------------- */

// old and new call styles all supported:
router.get("/", requireAuth, fetchTrips);            // /api/trips            (?scope=mine)
router.get("/all", requireAuth, fetchTrips);         // /api/trips/all        (alias)
router.get("/list", requireAuth, fetchTrips);        // /api/trips/list       (alias)

// (Optional) single trip by id if your UI calls it somewhere
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });

    const { appUser, gUser, roles } = await resolveContext(req);

    // reuse visibility constraints to ensure user can see this trip
    const where = await buildTripsWhere({ appUser, gUser, roles, scope: "" });
    where.id = id;

    const trip = await prisma.trip.findFirst({ where });
    if (!trip) return res.status(404).json({ message: "Not found" });

    res.json(trip);
  } catch (e) {
    console.error("GET /api/trips/:id error:", e);
    res.status(e.status || 500).json({ message: e.message || "Internal error" });
  }
});

export default router;
