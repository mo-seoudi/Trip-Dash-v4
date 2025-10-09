// server/src/routes/trips/trips.core.js
import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import jwt from "jsonwebtoken";

const router = Router();

const TRIP_REL_INCLUDE = {
  createdByUser: { select: { id: true, name: true, email: true } },
  parent: { select: { id: true } },
  children: { select: { id: true } },
  subTripDocs: true,
};

// Decode JWT from header/cookie (needs JWT_SECRET)
function getDecodedUser(req) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is required but missing. Set it in your environment.");
  }
  try {
    const bearer = req.headers.authorization || "";
    const token = bearer.startsWith("Bearer ")
      ? bearer.slice(7)
      : req.cookies?.token;
    if (!token) return null;
    return jwt.verify(token, secret);
  } catch {
    return null;
  }
}

/** GET /api/trips */
router.get("/", async (req, res, next) => {
  try {
    const decoded = getDecodedUser(req);

    let currentUser = null;
    if (decoded?.id) {
      currentUser = await prisma.user.findUnique({
        where: { id: Number(decoded.id) },
        select: { id: true, email: true, role: true, name: true },
      });
    }

    const { createdBy } = req.query;
    const nameNeedle =
      createdBy && String(createdBy).includes(" ")
        ? String(createdBy).split(" ")[0]
        : createdBy;

    const baseWhere = nameNeedle
      ? { createdBy: { contains: String(nameNeedle), mode: "insensitive" } }
      : undefined;

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

    try {
      const trips = await prisma.trip.findMany({
        where,
        orderBy: { id: "desc" },
        include: TRIP_REL_INCLUDE,
      });
      return res.json(trips);
    } catch {
      const trips = await prisma.trip.findMany({ where, orderBy: { id: "desc" } });
      return res.json(trips);
    }
  } catch (e) {
    next(e);
  }
});

/** POST /api/trips */
router.post("/", async (req, res, next) => {
  try {
    const decoded = getDecodedUser(req);

    const {
      createdById, createdBy, createdByEmail,
      tripType, destination, origin, date, departureTime,
      returnDate, returnTime, students, staff, status, price,
      notes, cancelRequest, busInfo, driverInfo, buses, parentId,
    } = req.body;

    const data = {
      createdById: createdById ?? (decoded?.id ? Number(decoded.id) : null),
      createdBy: createdBy ?? null,
      createdByEmail: createdByEmail ?? decoded?.email ?? null,
      tripType: tripType ?? null,
      origin: origin ?? null,                               // ← origin handled
      destination: destination ?? null,
      date: date ? new Date(date) : null,
      departureTime: departureTime ?? null,
      returnDate: returnDate ? new Date(returnDate) : null,
      returnTime: returnTime ?? null,
      students: typeof students === "number" ? students : students ? Number(students) : null,
      staff: typeof staff === "number" ? staff : staff ? Number(staff) : null,
      status: status ?? "Pending",
      price: typeof price === "number" ? price : price ? Number(price) : 0,
      notes: notes ?? null,
      cancelRequest: !!cancelRequest,
      busInfo: busInfo ?? null,
      driverInfo: driverInfo ?? null,
      buses: buses ?? null,
      parentId: parentId ?? null,
    };

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
    next(e);
  }
});

/** PATCH /api/trips/:id */
router.patch("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    // Only allow known fields (prevents Prisma "Unknown arg" 500s)
    const allow = new Set([
      "tripType","customType","origin","destination","date","departureTime",
      "returnDate","returnTime","students","staff","status","price","notes",
      "cancelRequest","busInfo","driverInfo","buses","parentId","createdBy",
      "createdByEmail","createdById"
    ]);

    const incoming = { ...req.body };
    Object.keys(incoming).forEach((k) => { if (!allow.has(k)) delete incoming[k]; });

    // Coercions
    if ("date" in incoming) incoming.date = incoming.date ? new Date(incoming.date) : null;
    if ("returnDate" in incoming) incoming.returnDate = incoming.returnDate ? new Date(incoming.returnDate) : null;

    if ("students" in incoming && typeof incoming.students !== "number") {
      incoming.students = incoming.students === "" || incoming.students === null
        ? null
        : Number(incoming.students);
    }
    if ("staff" in incoming && typeof incoming.staff !== "number") {
      incoming.staff = incoming.staff === "" || incoming.staff === null
        ? null
        : Number(incoming.staff);
    }
    if ("price" in incoming && typeof incoming.price !== "number") {
      incoming.price = incoming.price === "" || incoming.price === null
        ? 0
        : Number(incoming.price);
    }

    const updated = await prisma.trip.update({ where: { id }, data: incoming });

    try {
      const withRels = await prisma.trip.findUnique({ where: { id }, include: TRIP_REL_INCLUDE });
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
