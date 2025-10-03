// server/src/routes/trips/trips.core.js

import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import jwt from "jsonwebtoken";

const router = Router();

// Relations returned with each trip (when available)
const TRIP_REL_INCLUDE = {
  createdByUser: { select: { id: true, name: true, email: true } },
  parent: { select: { id: true } },
  children: { select: { id: true } },
  subTripDocs: true, // keep this name to match your schema relation
};

/** Read JWT from Authorization: Bearer <token> or cookie ('token' or legacy 'session') */
function getDecodedUser(req) {
  try {
    const bearer = req.headers.authorization || "";
    const token = bearer.startsWith("Bearer ")
      ? bearer.slice(7)
      : (req.cookies?.token || req.cookies?.session);
    if (!token) return null;
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

// Normalize role for simple checks
function normRole(r) {
  return (r || "").toString().trim().toLowerCase();
}

// Roles that may see more than their own trips
const PRIVILEGED = new Set([
  "admin",
  "bus_company",
  "transport_officer",
  "bus_company_officer",
  "finance",
]);

/**
 * GET /api/trips?createdBy=Name
 * Matches createdBy case-insensitively; if "First Last" is passed, uses the first token.
 * Enforces: non-privileged users (e.g. school_staff) only see their own trips.
 * Own trips are determined by (createdById = me.id) OR (createdByEmail = me.email) to
 * include older rows that might not have createdById populated.
 */
router.get("/", async (req, res, next) => {
  try {
    const { createdBy } = req.query;

    const needle =
      createdBy && String(createdBy).includes(" ")
        ? String(createdBy).split(" ")[0]
        : createdBy;

    // Build WHERE once; reuse in both include/fallback branches
    const where = {};

    if (needle) {
      where.createdBy = { contains: String(needle), mode: "insensitive" };
    }

    // 🔐 Enforce per-user visibility for non-privileged roles
    try {
      const decoded = getDecodedUser(req);
      const userId = Number(decoded?.id ?? decoded?.uid);
      if (userId) {
        // Load current user to know role and email
        const me = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, role: true, email: true },
        });

        const role = normRole(me?.role);
        const isPrivileged = PRIVILEGED.has(role);

        if (!isPrivileged) {
          // If you're school_staff (or anything not in PRIVILEGED), restrict to *your* trips.
          // Use OR on createdById / createdByEmail to catch legacy rows.
          const mine = [];
          if (me?.id)   mine.push({ createdById: me.id });
          if (me?.email) mine.push({ createdByEmail: me.email });

          if (mine.length > 0) {
            // If there was already a needle on createdBy name, AND it with "mine"
            if (where.createdBy) {
              where.AND = [{ OR: mine }, { createdBy: where.createdBy }];
              delete where.createdBy;
            } else {
              where.OR = mine;
            }
          } else {
            // No user data? Then safest is: show nothing to non-privileged users
            where.id = -1; // impossible id
          }
        }
      }
    } catch {
      // If decoding fails, we don't add the privileged filter here;
      // Your auth layer (if any) can decide whether anonymous access is allowed.
      // If you want to block anonymous entirely, uncomment the next line:
      // return res.status(401).json({ message: "Not logged in" });
    }

    // Prefer full response with relations; if that fails (e.g., schema drift), fall back gracefully.
    try {
      const trips = await prisma.trip.findMany({
        where: Object.keys(where).length ? where : undefined,
        orderBy: { id: "desc" },
        include: TRIP_REL_INCLUDE,
      });
      return res.json(trips);
    } catch (err) {
      console.warn("GET /api/trips include failed; falling back:", err?.message);
      const trips = await prisma.trip.findMany({
        where: Object.keys(where).length ? where : undefined,
        orderBy: { id: "desc" },
      });
      return res.json(trips);
    }
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/trips
 * Accepts Firestore-like payload; JSON blobs are stored as-is.
 */
router.post("/", async (req, res, next) => {
  try {
    const {
      createdById, createdBy, createdByEmail,
      tripType, destination, date, departureTime,
      returnDate, returnTime, students, status, price,
      notes, cancelRequest, busInfo, driverInfo, buses, parentId,
    } = req.body;

    const created = await prisma.trip.create({
      data: {
        createdById: createdById ?? null,
        createdBy: createdBy ?? null,
        createdByEmail: createdByEmail ?? null,
        tripType: tripType ?? null,
        destination: destination ?? null,
        date: date ? new Date(date) : null,
        departureTime: departureTime ?? null,
        returnDate: returnDate ? new Date(returnDate) : null,
        returnTime: returnTime ?? null,
        students: typeof students === "number" ? students : students ? Number(students) : null,
        status: status ?? "Pending",
        price: typeof price === "number" ? price : price ? Number(price) : 0,
        notes: notes ?? null,
        cancelRequest: !!cancelRequest,
        busInfo: busInfo ?? null,      // JSON
        driverInfo: driverInfo ?? null,// JSON
        buses: buses ?? null,          // JSON array
        parentId: parentId ?? null,
      },
    });

    // Return with relations when possible
    try {
      const withRels = await prisma.trip.findUnique({
        where: { id: created.id },
        include: TRIP_REL_INCLUDE,
      });
      return res.status(201).json(withRels ?? created);
    } catch {
      return res.status(201).json(created);
    }
  } catch (e) {
    next(e);
  }
});

/**
 * PATCH /api/trips/:id
 * Partial updates. Converts date-ish strings to Date.
 */
router.patch("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const data = { ...req.body };

    if ("date" in data) data.date = data.date ? new Date(data.date) : null;
    if ("returnDate" in data) data.returnDate = data.returnDate ? new Date(data.returnDate) : null;

    const updated = await prisma.trip.update({ where: { id }, data });

    try {
      const withRels = await prisma.trip.findUnique({
        where: { id },
        include: TRIP_REL_INCLUDE,
      });
      return res.json(withRels ?? updated);
    } catch {
      return res.json(updated);
    }
  } catch (e) {
    next(e);
  }
});

/** DELETE /api/trips/:id */
router.delete("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await prisma.trip.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
