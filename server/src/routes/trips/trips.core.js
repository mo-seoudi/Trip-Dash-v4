// server/src/routes/trips/trips.core.js

import { Router } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../../lib/prisma.js";

const router = Router();

// Relations returned with each trip (when available)
const TRIP_REL_INCLUDE = {
  createdByUser: { select: { id: true, name: true, email: true } },
  parent: { select: { id: true } },
  children: { select: { id: true } },
  subTripDocs: true,
};

/* ---------- tiny helper: decode JWT from Authorization or cookie ---------- */
function getDecoded(req) {
  try {
    const bearer = req.headers.authorization || "";
    const token = bearer.startsWith("Bearer ")
      ? bearer.slice(7)
      : req.cookies?.token || req.cookies?.session; // tolerate either name
    if (!token) return null;
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

/* ---------- GET /api/trips  ---------------------------------------------- *
 * - school_staff -> ONLY my trips (createdById OR createdByEmail OR createdBy)
 * - others       -> all trips, optionally filtered by ?createdBy= like before
 * ------------------------------------------------------------------------- */
router.get("/", async (req, res, next) => {
  try {
    const { createdBy } = req.query;

    // Keep your existing "search by createdBy (first word)" behavior
    const needle =
      createdBy && String(createdBy).includes(" ")
        ? String(createdBy).split(" ")[0]
        : createdBy;
    const searchFilter = needle
      ? { createdBy: { contains: String(needle), mode: "insensitive" } }
      : undefined;

    // Figure out who is calling
    const decoded = getDecoded(req);
    let me = null;
    if (decoded?.id) {
      me = await prisma.user.findUnique({
        where: { id: Number(decoded.id) },
        select: { id: true, email: true, name: true, role: true },
      });
    }

    // Base where
    let where = {};

    // If this is a school_staff, **restrict** to only their trips
    if (me && String(me.role).toLowerCase() === "school_staff") {
      const mine = {
        OR: [
          { createdById: me.id },
          me.email ? { createdByEmail: me.email } : undefined,
          me.name
            ? { createdBy: { equals: me.name, mode: "insensitive" } }
            : undefined,
        ].filter(Boolean),
      };
      where = searchFilter ? { AND: [mine, searchFilter] } : mine;
    } else {
      // non staff: preserve your existing optional filter
      if (searchFilter) where = searchFilter;
    }

    // Try with relations first; fall back if schema changed
    try {
      const trips = await prisma.trip.findMany({
        where,
        orderBy: { id: "desc" },
        include: TRIP_REL_INCLUDE,
      });
      return res.json(trips);
    } catch (err) {
      console.warn("GET /api/trips include failed; falling back:", err?.message);
      const trips = await prisma.trip.findMany({
        where,
        orderBy: { id: "desc" },
      });
      return res.json(trips);
    }
  } catch (e) {
    next(e);
  }
});

/* ---------- POST /api/trips (unchanged) ---------------------------------- */
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
        students:
          typeof students === "number"
            ? students
            : students
            ? Number(students)
            : null,
        status: status ?? "Pending",
        price:
          typeof price === "number"
            ? price
            : price
            ? Number(price)
            : 0,
        notes: notes ?? null,
        cancelRequest: !!cancelRequest,
        busInfo: busInfo ?? null,      // JSON
        driverInfo: driverInfo ?? null,// JSON
        buses: buses ?? null,          // JSON array
        parentId: parentId ?? null,
      },
    });

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

/* ---------- PATCH /api/trips/:id (unchanged) ----------------------------- */
router.patch("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const data = { ...req.body };

    if ("date" in data) data.date = data.date ? new Date(data.date) : null;
    if ("returnDate" in data)
      data.returnDate = data.returnDate ? new Date(data.returnDate) : null;

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

/* ---------- DELETE /api/trips/:id (unchanged) ---------------------------- */
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
