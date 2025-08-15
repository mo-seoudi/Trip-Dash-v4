// trips.subtrips.js

import { Router } from "express";
import { prisma } from "../../lib/prisma.js";

const router = Router();

// GET /api/trips/:id/subtrips
router.get("/:id/subtrips", async (req, res, next) => {
  try {
    const parentTripId = Number(req.params.id);
    const subs = await prisma.subTrip.findMany({
      where: { parentTripId },
      orderBy: { createdAt: "asc" },
    });
    res.json(subs);
  } catch (e) {
    next(e);
  }
});

// POST /api/trips/:id/subtrips
router.post("/:id/subtrips", async (req, res, next) => {
  try {
    const parentTripId = Number(req.params.id);
    const { buses = [] } = req.body;

    if (!Array.isArray(buses) || buses.length === 0) {
      const created = await prisma.subTrip.create({ data: { parentTripId, status: "Pending" } });
      return res.status(201).json([created]);
    }

    const created = await prisma.$transaction(
      buses.map((b) =>
        prisma.subTrip.create({
          data: {
            parentTripId,
            status: "Confirmed",
            busSeats: b.busSeats ?? null,
            busType: b.busType ?? null,
            tripPrice: b.tripPrice ? Number(b.tripPrice) : null,
          },
        })
      )
    );
    res.status(201).json(created);
  } catch (e) {
    next(e);
  }
});

export default router;
