//server/src/routes/trips/trips.passengers.js

import { Router } from "express";
import { prisma } from "../../lib/prisma.js";

const router = Router();

// GET /api/trips/:id/passengers
router.get("/:id/passengers", async (req, res, next) => {
  try {
    const tripId = Number(req.params.id);
    const passengers = await prisma.tripPassenger.findMany({
      where: { tripId },
      orderBy: { createdAt: "asc" },
      // include: { passenger: true }, // enable if you have this relation
    });
    res.json({ passengers });
  } catch (e) {
    next(e);
  }
});

// POST /api/trips/:id/passengers  { items: [...], createDirectory?: boolean }
router.post("/:id/passengers", async (req, res, next) => {
  try {
    const tripId = Number(req.params.id);
    const { items = [], createDirectory = true } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "items array is required" });
    }

    const created = await prisma.$transaction(
      items.map((p) =>
        prisma.tripPassenger.create({
          data: {
            tripId,
            fullName: p.fullName ?? null,
            grade: p.grade ?? null,
            guardianName: p.guardianName ?? null,
            guardianPhone: p.guardianPhone ?? null,
            pickupPoint: p.pickupPoint ?? null,
            dropoffPoint: p.dropoffPoint ?? null,
            seatNumber: p.seatNumber ?? null,
            notes: p.notes ?? null,
            checkedIn: false,
            checkedOut: false,
          },
        })
      )
    );

    if (createDirectory) {
      for (const p of items) {
        try {
          await prisma.passenger.upsert({
            // TODO: replace with your actual unique key
            where: { fullName: p.fullName },
            update: { grade: p.grade ?? undefined },
            create: { fullName: p.fullName, grade: p.grade ?? null },
          });
        } catch { /* ignore if unique constraint doesn't fit */ }
      }
    }

    res.status(201).json(created);
  } catch (e) {
    next(e);
  }
});

// PATCH /api/trips/:id/passengers/:rowId
router.patch("/:id/passengers/:rowId", async (req, res, next) => {
  try {
    const id = Number(req.params.rowId);
    const updated = await prisma.tripPassenger.update({
      where: { id },
      data: { ...req.body },
    });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

// POST /api/trips/:id/passengers/:rowId/payment
router.post("/:id/passengers/:rowId/payment", async (req, res, next) => {
  try {
    const tripPassengerId = Number(req.params.rowId);
    const {
      amountDue,
      amountPaid = 0,
      status = "unpaid",
      method = null,
      reference = null,
      currency = "USD",
    } = req.body;

    const payment = await prisma.tripPassengerPayment.create({
      data: {
        tripPassengerId,
        amountDue: Number(amountDue),
        amountPaid: Number(amountPaid),
        status,
        method,
        reference,
        currency,
      },
    });

    res.status(201).json(payment);
  } catch (e) {
    next(e);
  }
});

export default router;
