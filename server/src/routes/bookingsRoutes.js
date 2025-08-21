// server/src/routes/bookingsRoutes.js

import express from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = express.Router();

/**
 * GET /api/bookings?createdBy=<string>
 * Lists bookings, newest first. Optional case-insensitive filter on createdBy.
 */
router.get("/", async (req, res, next) => {
  try {
    const { createdBy } = req.query;

    const needle =
      createdBy && String(createdBy).includes(" ")
        ? String(createdBy).split(" ")[0]
        : createdBy;

    const rows = await prisma.busBooking.findMany({
      where: needle
        ? { createdBy: { contains: String(needle), mode: "insensitive" } }
        : undefined,
      orderBy: { createdAt: "desc" },
    });

    res.json(rows);
  } catch (e) {
    console.error("GET /api/bookings failed:", e);
    next(e);
  }
});

/**
 * POST /api/bookings
 * Body example:
 * {
 *   title, purpose,
 *   date, startTime, endDate, endTime, durationMinutes,
 *   students, adults,
 *   pickupPoints: [{location, time}], dropoffPoints: [{location, time}],
 *   busesRequested, busType, notes,
 *   createdBy, createdByEmail
 * }
 */
router.post("/", async (req, res, next) => {
  try {
    const {
      title,
      purpose,
      date,
      startTime,
      endDate,
      endTime,
      durationMinutes,
      students,
      adults,
      pickupPoints,
      dropoffPoints,
      busesRequested,
      busType,
      notes,
      createdBy,
      createdByEmail,
      createdById,
      orgId,
      status,
    } = req.body || {};

    const totalPassengers =
      (typeof students === "number" ? students : Number(students) || 0) +
      (typeof adults === "number" ? adults : Number(adults) || 0);

    const created = await prisma.busBooking.create({
      data: {
        title: title ?? null,
        purpose: purpose ?? null,
        date: date ? new Date(date) : null,
        startTime: startTime ?? null,
        endDate: endDate ? new Date(endDate) : null,
        endTime: endTime ?? null,
        durationMinutes:
          typeof durationMinutes === "number"
            ? durationMinutes
            : durationMinutes
            ? Number(durationMinutes)
            : null,
        students:
          typeof students === "number"
            ? students
            : students
            ? Number(students)
            : 0,
        adults:
          typeof adults === "number" ? adults : adults ? Number(adults) : 0,
        totalPassengers,
        pickupPoints: Array.isArray(pickupPoints) ? pickupPoints : null,
        dropoffPoints: Array.isArray(dropoffPoints) ? dropoffPoints : null,
        busesRequested:
          typeof busesRequested === "number"
            ? busesRequested
            : busesRequested
            ? Number(busesRequested)
            : null,
        busType: busType ?? null,
        notes: notes ?? null,
        createdBy: createdBy ?? null,
        createdByEmail: createdByEmail ?? null,
        createdById: createdById ?? null,
        orgId: orgId ?? null,
        status: status ?? "Requested",
      },
    });

    res.status(201).json(created);
  } catch (e) {
    console.error("POST /api/bookings failed:", e);
    next(e);
  }
});

/** PATCH /api/bookings/:id */
router.patch("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const data = { ...req.body };

    if ("date" in data) data.date = data.date ? new Date(data.date) : null;
    if ("endDate" in data)
      data.endDate = data.endDate ? new Date(data.endDate) : null;

    if ("durationMinutes" in data && typeof data.durationMinutes !== "number") {
      data.durationMinutes = data.durationMinutes
        ? Number(data.durationMinutes)
        : null;
    }

    if ("students" in data && typeof data.students !== "number") {
      data.students = data.students ? Number(data.students) : 0;
    }
    if ("adults" in data && typeof data.adults !== "number") {
      data.adults = data.adults ? Number(data.adults) : 0;
    }
    if ("students" in data || "adults" in data) {
      const s = "students" in data ? data.students : undefined;
      const a = "adults" in data ? data.adults : undefined;
      if (typeof s === "number" || typeof a === "number") {
        data.totalPassengers =
          (typeof s === "number" ? s : undefined) ??
          undefined +
            ((typeof a === "number" ? a : undefined) ?? 0);
      }
    }

    const updated = await prisma.busBooking.update({
      where: { id },
      data,
    });

    res.json(updated);
  } catch (e) {
    console.error("PATCH /api/bookings/:id failed:", e);
    next(e);
  }
});

/** DELETE /api/bookings/:id */
router.delete("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await prisma.busBooking.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/bookings/:id failed:", e);
    next(e);
  }
});

export default router;
