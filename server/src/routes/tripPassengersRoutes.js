// server/src/routes/tripPassengersRoutes.js
import express from "express";
import { PrismaClient } from "@prisma/client";
import { requireAuth } from "../middleware/auth.js";
import { requireOrg } from "../middleware/requireOrg.js";

const prisma = new PrismaClient();
const router = express.Router();

/** helpers */
async function canViewRoster(prisma, tripId, userId, orgId) {
  const trip = await prisma.trip.findUnique({
    where: { id: Number(tripId) },
    select: { id: true, createdById: true },
  });
  if (!trip) return { ok: false, code: 404, msg: "Trip not found" };
  if (trip.createdById === userId) return { ok: true, trip };

  // If you created "TripRosterShare" via SQL (PascalCase), use raw until Prisma models are mapped
  const share = await prisma.$queryRaw`
    select 1
    from "TripRosterShare" s
    where s."tripId" = ${Number(tripId)}
      and (s."targetUserId" = ${userId} or s."targetOrgId" = ${orgId})
      and s."canView" = true
    limit 1
  `;
  if (Array.isArray(share) && share.length) return { ok: true, trip };

  return { ok: false, code: 403, msg: "No roster access" };
}

async function canEditRoster(prisma, tripId, userId) {
  const trip = await prisma.trip.findUnique({
    where: { id: Number(tripId) },
    select: { id: true, createdById: true, status: true },
  });
  if (!trip) return { ok: false, code: 404, msg: "Trip not found" };
  if (!["Accepted", "Confirmed", "Completed"].includes(trip.status || "")) {
    return { ok: false, code: 400, msg: "Add/edit roster only after bus is assigned" };
  }
  if (trip.createdById !== userId) {
    // If you later add editors, extend this check
    return { ok: false, code: 403, msg: "Only trip creator can edit roster" };
  }
  return { ok: true, trip };
}

/** GET /api/trips/:id/passengers */
router.get("/:id/passengers", requireAuth, requireOrg, async (req, res, next) => {
  try {
    const tripId = Number(req.params.id);
    const { ok, code, msg } = await canViewRoster(prisma, tripId, req.user.id, req.activeOrgId);
    if (!ok) return res.status(code).json({ message: msg });

    const rows = await prisma.$queryRaw`
      select tp.*, pay."amountDue", pay."amountPaid", pay."status" as "paymentStatus"
      from "TripPassenger" tp
      left join lateral (
         select p.*
         from "TripPassengerPayment" p
         where p."tripPassengerId" = tp.id
         order by p."createdAt" desc
         limit 1
      ) pay on true
      where tp."tripId" = ${tripId}
      order by tp."createdAt" asc
    `;
    res.json({ passengers: rows });
  } catch (e) {
    next(e);
  }
});

/** POST /api/trips/:id/passengers  body: { items:[{fullName, grade, guardianName, guardianPhone, pickupPoint, dropoffPoint, seatNumber, notes}], createDirectory?:boolean } */
router.post("/:id/passengers", requireAuth, requireOrg, async (req, res, next) => {
  try {
    const tripId = Number(req.params.id);
    const { ok, code, msg } = await canEditRoster(prisma, tripId, req.user.id);
    if (!ok) return res.status(code).json({ message: msg });

    const { items = [], createDirectory = true } = req.body || {};
    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ message: "No passengers provided" });
    }

    const created = await prisma.$transaction(async (tx) => {
      const inserted = [];
      for (const p of items) {
        let passengerId = null;
        if (createDirectory) {
          const insertedP = await tx.$queryRaw`
            insert into "Passenger" ("schoolOrgId","fullName","grade","guardianName","guardianPhone","notes")
            values (${req.activeOrgId}, ${p.fullName || ""}, ${p.grade || null}, ${p.guardianName || null}, ${p.guardianPhone || null}, ${p.notes || null})
            returning id
          `;
          passengerId = insertedP?.[0]?.id || null;
        }

        const row = await tx.$queryRaw`
          insert into "TripPassenger"
            ("tripId","passengerId","fullName","grade","guardianName","guardianPhone","pickupPoint","dropoffPoint","seatNumber","notes")
          values
            (${tripId}, ${passengerId}, ${p.fullName || ""}, ${p.grade || null}, ${p.guardianName || null}, ${p.guardianPhone || null},
             ${p.pickupPoint || null}, ${p.dropoffPoint || null}, ${p.seatNumber || null}, ${p.notes || null})
          returning *
        `;
        inserted.push(row?.[0]);
      }
      return inserted;
    });

    res.status(201).json(created);
  } catch (e) {
    next(e);
  }
});

/** PATCH /api/trips/:id/passengers/:pid */
router.patch("/:id/passengers/:pid", requireAuth, requireOrg, async (req, res, next) => {
  try {
    const tripId = Number(req.params.id);
    const pid = Number(req.params.pid);
    const { ok, code, msg } = await canEditRoster(prisma, tripId, req.user.id);
    if (!ok) return res.status(code).json({ message: msg });

    const d = req.body || {};
    const row = await prisma.$queryRaw`
      update "TripPassenger" set
        "fullName"      = coalesce(${d.fullName}, "TripPassenger"."fullName"),
        "grade"         = coalesce(${d.grade}, "TripPassenger"."grade"),
        "guardianName"  = coalesce(${d.guardianName}, "TripPassenger"."guardianName"),
        "guardianPhone" = coalesce(${d.guardianPhone}, "TripPassenger"."guardianPhone"),
        "pickupPoint"   = coalesce(${d.pickupPoint}, "TripPassenger"."pickupPoint"),
        "dropoffPoint"  = coalesce(${d.dropoffPoint}, "TripPassenger"."dropoffPoint"),
        "seatNumber"    = coalesce(${d.seatNumber}, "TripPassenger"."seatNumber"),
        "checkedInAt"   = coalesce(${d.checkedInAt ? new Date(d.checkedInAt) : null}, "TripPassenger"."checkedInAt"),
        "checkedOutAt"  = coalesce(${d.checkedOutAt ? new Date(d.checkedOutAt) : null}, "TripPassenger"."checkedOutAt"),
        "notes"         = coalesce(${d.notes}, "TripPassenger"."notes")
      where id = ${pid} and "tripId" = ${tripId}
      returning *
    `;
    if (!row?.length) return res.status(404).json({ message: "Roster entry not found" });
    res.json(row[0]);
  } catch (e) {
    next(e);
  }
});

/** POST /api/trips/:id/passengers/:pid/payment */
router.post("/:id/passengers/:pid/payment", requireAuth, requireOrg, async (req, res, next) => {
  try {
    const tripId = Number(req.params.id);
    const pid = Number(req.params.pid);
    const { ok, code, msg } = await canEditRoster(prisma, tripId, req.user.id); // or require school finance
    if (!ok) return res.status(code).json({ message: msg });

    const {
      amountDue,
      amountPaid = 0,
      status = "unpaid",
      method = null,
      reference = null,
      currency = "AED",
    } = req.body || {};
    if (!(amountDue > 0)) return res.status(400).json({ message: "amountDue must be > 0" });

    const row = await prisma.$queryRaw`
      insert into "TripPassengerPayment"
        ("tripPassengerId","currency","amountDue","amountPaid","status","method","reference")
      values
        (${pid}, ${currency}, ${Number(amountDue)}, ${Number(amountPaid)}, ${status}, ${method}, ${reference})
      returning *
    `;
    res.status(201).json(row?.[0] || {});
  } catch (e) {
    next(e);
  }
});

export default router;
