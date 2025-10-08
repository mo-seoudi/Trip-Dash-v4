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

// ✅ helper to decode your JWT (from cookie or Authorization) – requires env secret
function getDecodedUser(req) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // Developer/config error – surface it clearly
    throw new Error("JWT_SECRET is required but missing. Set it in your environment.");
  }
  try {
    const bearer = req.headers.authorization || "";
    const token = bearer.startsWith("Bearer ")
      ? bearer.slice(7)
      : req.cookies?.token; // your cookie name
    if (!token) return null;
    return jwt.verify(token, secret);
  } catch {
    return null;
  }
}

/**
 * GET /api/trips?createdBy=Name
 * - If role === school_staff => show only trips they created
 * - Otherwise keep the existing behavior (optionally narrowed by createdBy search)
 */
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

router.patch("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const data = { ...req.body };
    if ("date" in data) data.date = data.date ? new Date(data.date) : null;
    if ("returnDate" in data) data.returnDate = data.returnDate ? new Date(data.returnDate) : null;

    const updated = await prisma.trip.update({ where: { id }, data });
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
