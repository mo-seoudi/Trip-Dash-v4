import { Router } from "express";
import { operationalRequestContext, requireOperationalContext } from "../../runtime/operationalRequestContext.js";
import { listTrips, getTrip, createTrip } from "../../domain/trips/tripController.js";
import { listBusAssignments, createBusAssignment } from "../../domain/trips/busAssignmentController.js";
import { listPassengers, addPassengers, updatePassenger, removePassenger } from "../../domain/trips/passengerController.js";
import { listPassengerAllocations, allocatePassenger, movePassenger, unallocatePassenger } from "../../domain/trips/passengerAllocationController.js";

const router = Router({ mergeParams: true });

router.get("/trips", operationalRequestContext("trip.read"), requireOperationalContext, listTrips);
router.post("/trips", operationalRequestContext("trip.create"), requireOperationalContext, createTrip);
router.get("/trips/:tripId", operationalRequestContext("trip.read"), requireOperationalContext, getTrip);

router.get("/trips/:tripId/bus-assignments", operationalRequestContext("trip.read"), requireOperationalContext, listBusAssignments);
router.post("/trips/:tripId/bus-assignments", operationalRequestContext("bus_assignment.manage"), requireOperationalContext, createBusAssignment);

// Passenger PII stays behind dedicated permissions even when the parent trip is readable.
router.get("/trips/:tripId/passengers", operationalRequestContext("passenger.read"), requireOperationalContext, listPassengers);
router.post("/trips/:tripId/passengers", operationalRequestContext("passenger.manage"), requireOperationalContext, addPassengers);
router.patch("/trips/:tripId/passengers/:passengerId", operationalRequestContext("passenger.manage"), requireOperationalContext, updatePassenger);
router.delete("/trips/:tripId/passengers/:passengerId", operationalRequestContext("passenger.manage"), requireOperationalContext, removePassenger);

router.get("/trips/:tripId/passenger-allocations", operationalRequestContext("passenger.read"), requireOperationalContext, listPassengerAllocations);
router.post("/trips/:tripId/bus-assignments/:busAssignmentId/passengers/:passengerId", operationalRequestContext("bus_assignment.manage"), requireOperationalContext, allocatePassenger);
router.put("/trips/:tripId/passengers/:passengerId/bus-allocation", operationalRequestContext("bus_assignment.manage"), requireOperationalContext, movePassenger);
router.delete("/trips/:tripId/passengers/:passengerId/bus-allocation", operationalRequestContext("bus_assignment.manage"), requireOperationalContext, unallocatePassenger);

export default router;
