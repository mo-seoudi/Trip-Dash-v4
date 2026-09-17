import { Router } from "express";
import { operationalRequestContext, requireOperationalContext } from "../../runtime/operationalRequestContext.js";
import { listTrips, getTrip, createTrip } from "../../domain/trips/tripController.js";
import { listBusAssignments, createBusAssignment } from "../../domain/trips/busAssignmentController.js";

const router = Router({ mergeParams: true });

router.get(
  "/trips",
  operationalRequestContext("trip.read"),
  requireOperationalContext,
  listTrips
);

router.post(
  "/trips",
  operationalRequestContext("trip.create"),
  requireOperationalContext,
  createTrip
);

router.get(
  "/trips/:tripId",
  operationalRequestContext("trip.read"),
  requireOperationalContext,
  getTrip
);

router.get(
  "/trips/:tripId/bus-assignments",
  operationalRequestContext("trip.read"),
  requireOperationalContext,
  listBusAssignments
);

router.post(
  "/trips/:tripId/bus-assignments",
  operationalRequestContext("bus_assignment.manage"),
  requireOperationalContext,
  createBusAssignment
);

export default router;
