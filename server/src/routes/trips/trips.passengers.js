// server/src/routes/trips/trips.passengers.js
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
    let { items = [], createDirectory = true } = req.body;

    if (!Array.isArray(items)) {
      return res.status(400).json({ error: "items must be an array" });
    }

    // Normalize inputs:
    // - allow plain strings ("Jack Smith")
    // - allow { name: "Jack Smith", ... }
    // - allow { fullName: "Jack Smith", ... }
    const normalized = items
      .map((raw) => {
        if (typeof raw === "string") {
          const fullName = raw.trim();
          return fullName ? { fullName } : null;
        }
        const fullName = (raw.fullName || raw.name || "").trim();
        if (!fullName) return null;
        return {
          fullName,
          grade: raw.grade ?? raw.class ?? null,
          guardianName: raw.guardianName ?? raw.parentName ?? null,
          guardianPhone: raw.guardianPhone ?? raw.parentPhone ?? null,
          pickupPoint: raw.pickupPoint ?? raw.pickup ?? null,
          dropoffPoint: raw.dropoffPoint ?? raw.dropoff ?? null,
          seatNumber: raw.seatNumber ?? raw.seat ?? null,
          notes: raw.notes ?? null,
        };
      })
      .filter(Boolean);

    if (normalized.length === 0) {
      return res.status(400).json({ error: "No valid passengers to add" });
    }

    const created = await prisma.$transaction(
      normalized.map((p) =>
        prisma.tripPassenger.create({
          data: {
            tripId,
            fullName: p.fullName, // guaranteed non-empty string
            grade: p.grade,
            guardianName: p.guardianName,
            guardianPhone: p.guardianPhone,
            pickupPoint: p.pickupPoint,
            dropoffPoint: p.dropoffPoint,
            seatNumber: p.seatNumber,
            notes: p.notes,
            checkedIn: false,
            checkedOut: false,
          },
        })
      )
    );

    // Optional directory upserts (best effort)
    if (createDirectory) {
      for (const p of normalized) {
        try {
          await prisma.passenger.upsert({
            where: { fullName: p.fullName },
            update: { grade: p.grade ?? undefined },
            create: { fullName: p.fullName, grade: p.grade ?? null },
          });
        } catch {
          // ignore duplicate/constraint noise
        }
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
