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
  try {
    const bearer = req.headers.authorization || "";
    const token = bearer.startsWith("Bearer ")
      ? bearer.slice(7)
      : req.cookies?.token;            // <-- your cookie name
    if (!token) return null;
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

router.get("/", async (req, res, next) => {
  try {
    const decoded = getDecodedUser(req);
    // Not logged in? keep current behavior (or you can 401 if you prefer)
    let currentUser = null;
    if (decoded?.id) {
      currentUser = await prisma.user.findUnique({
        where: { id: Number(decoded.id) },
        select: { id: true, email: true, role: true },
      });
    }

    // Optional search by createdBy (you already had this)
    const { createdBy } = req.query;
    const nameNeedle =
      createdBy && String(createdBy).includes(" ")
        ? String(createdBy).split(" ")[0]
        : createdBy;

    // ---- base filter (kept the same as your version) ----
    const baseWhere = nameNeedle
      ? { createdBy: { contains: String(nameNeedle), mode: "insensitive" } }
      : undefined;

    // ---- NEW: if school_staff, show only own trips ----
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
    } catch (err) {
      // graceful fallback if include changes
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
export default router;

