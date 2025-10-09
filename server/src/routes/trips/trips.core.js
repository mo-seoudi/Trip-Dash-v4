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

// helper to decode your JWT (from cookie or Authorization)
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
      destination: destination ?? null,
      origin: origin ?? null,                                   // NEW

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

    // ALLOWLIST ONLY FIELDS THAT EXIST IN THE Trip MODEL
    const {
      tripType,
      destination,
      origin,           // NEW
      date,
      departureTime,
      returnDate,
      returnTime,
      students,
      staff,
      status,
      price,
      notes,
      cancelRequest,
      busInfo,
      driverInfo,
      buses,
      parentId,
      // Everything else (customType, boosterSeatsRequested, boosterSeatCount, editRequest, etc.)
      // will be intentionally ignored to avoid Prisma "Unknown arg" errors.
    } = req.body || {};

    const data = {
      ...(tripType !== undefined && { tripType }),
      ...(destination !== undefined && { destination }),
      ...(origin !== undefined && { origin }),
      ...(date !== undefined && { date: date ? new Date(date) : null }),
      ...(departureTime !== undefined && { departureTime }),
      ...(returnDate !== undefined && { returnDate: returnDate ? new Date(returnDate) : null }),
      ...(returnTime !== undefined && { returnTime }),
      ...(students !== undefined && {
        students:
          typeof students === "number" ? students :
          students === "" || students === null ? null : Number(students),
      }),
      ...(staff !== undefined && {
        staff:
          typeof staff === "number" ? staff :
          staff === "" || staff === null ? null : Number(staff),
      }),
      ...(status !== undefined && { status }),
      ...(price !== undefined && {
        price: typeof price === "number" ? price : price ? Number(price) : 0,
      }),
      ...(notes !== undefined && { notes }),
      ...(cancelRequest !== undefined && { cancelRequest: !!cancelRequest }),
      ...(busInfo !== undefined && { busInfo }),
      ...(driverInfo !== undefined && { driverInfo }),
      ...(buses !== undefined && { buses }),
      ...(parentId !== undefined && { parentId }),
    };

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
