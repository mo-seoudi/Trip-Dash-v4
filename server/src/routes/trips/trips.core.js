// server/src/routes/trips/trips.core.js

import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import jwt from "jsonwebtoken";

const router = Router();

/** Relations returned with each trip */
const TRIP_REL_INCLUDE = {
  createdByUser: { select: { id: true, name: true, email: true } },
  parent: { select: { id: true } },
  children: { select: { id: true } },
  subTripDocs: true,
};

/** Decode JWT from either Authorization: Bearer <token> or cookie "token" */
// use the same secret fallback as authRoutes.js
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

function getDecodedUser(req) {
  try {
    const bearer = req.headers.authorization || "";
    const token = bearer.startsWith("Bearer ")
      ? bearer.slice(7)
      : req.cookies?.token; // cookie name used across the app
    if (!token) return null;
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (e) {
    console.warn("[TRIPS] JWT verify failed:", e?.message);
    return null;
  }
}

/**
 * GET /api/trips?createdBy=Name
 * - If role === school_staff => show only trips they created
 * - Otherwise keep existing behavior (optionally narrowed by createdBy search)
 */
router.get("/", async (req, res, next) => {
  try {
    const decoded = getDecodedUser(req);

    const currentUser = decoded?.id
      ? await prisma.user.findUnique({
          where: { id: Number(decoded.id) },
          select: { id: true, email: true, role: true, name: true },
        })
      : null;

    // Optional search by creator display name; if "First Last" passed, use the first token.
    const { createdBy } = req.query;
    const nameNeedle =
      createdBy && String(createdBy).includes(" ")
        ? String(createdBy).split(" ")[0]
        : createdBy;

    const baseWhere = nameNeedle
      ? { createdBy: { contains: String(nameNeedle), mode: "insensitive" } }
      : undefined;

    // NEW: restrict school_staff to trips they created (by id OR email)
    let where = baseWhere;
    if (currentUser?.role === "school_staff") {
      where = {
        AND: [
          baseWhere || {},
          {
            OR: [
              { createdById: currentUser.id },
              { createdByEmail: currentUser.email },
            ],
          },
        ],
      };
    }

    // tiny trace to confirm behavior in Render logs
    console.log("[TRIPS] list", {
      role: currentUser?.role || null,
      userId: currentUser?.id || null,
      email: currentUser?.email || null,
    });

    try {
      const trips = await prisma.trip.findMany({
        where,
        orderBy: { id: "desc" },
        include: TRIP_REL_INCLUDE,
      });
      return res.json(trips);
    } catch (err) {
      console.warn("[TRIPS] include failed; fallback:", err?.message);
      const trips = await prisma.trip.findMany({ where, orderBy: { id: "desc" } });
      return res.json(trips);
    }
  } catch (e) {
    console.error("[TRIPS] GET / error:", e);
    next(e);
  }
});

/**
 * POST /api/trips
 * Stamps creator fields from JWT if not provided in body.
 * (Keeps your existing Firestore-like payload shape.)
 */
router.post("/", async (req, res, next) => {
  try {
    const decoded = getDecodedUser(req);

    const {
      createdById, createdBy, createdByEmail,
      tripType, destination, date, departureTime,
      returnDate, returnTime, students, status, price,
      notes, cancelRequest, busInfo, driverInfo, buses, parentId,
    } = req.body;

    const data = {
      createdById: createdById ?? (decoded?.id ? Number(decoded.id) : null),
      createdBy: createdBy ?? null,
      createdByEmail: createdByEmail ?? decoded?.email ?? null,

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
      busInfo: busInfo ?? null,       // JSON
      driverInfo: driverInfo ?? null, // JSON
      buses: buses ?? null,           // JSON
      parentId: parentId ?? null,
    };

    if (!data.createdById && !data.createdByEmail) {
      console.warn("[TRIPS] creating without creator fields — school_staff filters will not match.");
    }

    const created = await prisma.trip.create({ data });

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
    console.error("[TRIPS] POST / error:", e);
    next(e);
  }
});

/** PATCH /api/trips/:id (partial update) */
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
    console.error("[TRIPS] PATCH /:id error:", e);
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
    console.error("[TRIPS] DELETE /:id error:", e);
    next(e);
  }
});

export default router;
