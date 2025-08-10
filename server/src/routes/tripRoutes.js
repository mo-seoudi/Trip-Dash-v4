// server/src/routes/tripRoutes.js

import express from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = express.Router();

/** GET /api/trips?createdBy=Name */
router.get("/", async (req, res, next) => {
  try {
    const { createdBy } = req.query;

    const trips = await prisma.trip.findMany({
      where: createdBy
        ? { createdByName: { equals: String(createdBy), mode: "insensitive" } }
        : undefined,
      orderBy: { createdAt: "desc" }, // server-side sort so client doesn’t have to
      include: {
        buses: { include: { bus: true } },
        parent: { select: { id: true } },
        children: { select: { id: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    res.json(trips);
  } catch (e) {
    next(e);
  }
});

/** POST /api/trips  (body: { createdById?, createdByName?, status?, routeId?, date?, direction? }) */
router.post("/", async (req, res, next) => {
  try {
    const {
      createdById,
      createdByName,
      status, // "Confirmed"|"Draft"|etc. -> Prisma enum is UPPERCASE
      routeId,
      date,
      direction,
      parentId,
    } = req.body;

    const trip = await prisma.trip.create({
      data: {
        createdById: createdById ?? null,
        createdByName: createdByName ?? null,
        status: status ? status.toUpperCase() : undefined,
        routeId: routeId ?? null,
        date: date ? new Date(date) : null,
        direction: direction ? direction.toUpperCase() : null,
        parentId: parentId ?? null,
      },
    });

    res.status(201).json(trip);
  } catch (e) {
    next(e);
  }
});

/** PATCH /api/trips/:id  (partial update; supports { status, buses }) */
router.patch("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { status, ...rest } = req.body;

    // If the client passes `buses: number[]` we upsert TripBus rows
    if (Array.isArray(req.body.buses)) {
      const busIds = req.body.buses.map(Number);

      // remove all current assignments then add the new list
      await prisma.tripBus.deleteMany({ where: { tripId: id } });
      if (busIds.length) {
        await prisma.tripBus.createMany({
          data: busIds.map((busId) => ({ tripId: id, busId })),
          skipDuplicates: true,
        });
      }
    }

    const trip = await prisma.trip.update({
      where: { id },
      data: {
        ...rest,
        status: status ? status.toUpperCase() : undefined,
      },
      include: { buses: { include: { bus: true } } },
    });

    res.json(trip);
  } catch (e) {
    next(e);
  }
});

/** DELETE /api/trips/:id */
router.delete("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await prisma.tripBus.deleteMany({ where: { tripId: id } });
    await prisma.trip.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

/** POST /api/trips/:id/subtrips  (body: { buses: number[] }) */
router.post("/:id/subtrips", async (req, res, next) => {
  try {
    const parentId = Number(req.params.id);
    const { buses = [] } = req.body;

    // create one child trip per bus
    const created = await prisma.$transaction(
      buses.map((busId) =>
        prisma.trip.create({
          data: {
            parentId,
            status: "CONFIRMED",
            // You may want to copy route/date/direction/creator from parent:
            // parent fields are accessible by a separate read if needed
          },
        })
      )
    );

    res.status(201).json(created);
  } catch (e) {
    next(e);
  }
});

/** GET /api/trips/:id/subtrips */
router.get("/:id/subtrips", async (req, res, next) => {
  try {
    const parentId = Number(req.params.id);
    const subs = await prisma.trip.findMany({
      where: { parentId },
      orderBy: { createdAt: "asc" },
      include: { buses: { include: { bus: true } } },
    });
    res.json(subs);
  } catch (e) {
    next(e);
  }
});

export default router;
