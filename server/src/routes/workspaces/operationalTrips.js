import { Router } from "express";
import { operationalRequestContext, requireOperationalContext } from "../../runtime/operationalRequestContext.js";
import { listTrips, getTrip, createTrip, updateTrip, acceptTrip, rejectTrip, completeTrip, cancelTrip, deleteTrip } from "../../domain/trips/tripController.js";
import { getQuotation, submitQuotation, reviseQuotation, requestApproval, approveQuotation, requestChanges, confirmTrip } from "../../domain/trips/tripWorkflowController.js";
import { listBusAssignments, createBusAssignment } from "../../domain/trips/busAssignmentController.js";
import { listPassengers, addPassengers, updatePassenger, removePassenger } from "../../domain/trips/passengerController.js";
import { listPassengerAllocations, allocatePassenger, movePassenger, unallocatePassenger } from "../../domain/trips/passengerAllocationController.js";

const router = Router({ mergeParams: true });

router.get("/trips", operationalRequestContext("trip.read"), requireOperationalContext, listTrips);
router.post("/trips", operationalRequestContext("trip.create"), requireOperationalContext, createTrip);
router.get("/trips/:tripId", operationalRequestContext("trip.read"), requireOperationalContext, getTrip);
router.patch("/trips/:tripId", operationalRequestContext("trip.edit_request"), requireOperationalContext, updateTrip);

// Canonical lifecycle actions use the same scoped operational context as trip CRUD.
// The service owns transition validation; callers cannot PATCH status directly.
router.post("/trips/:tripId/accept", operationalRequestContext("trip.respond"), requireOperationalContext, acceptTrip);
router.post("/trips/:tripId/reject", operationalRequestContext("trip.respond"), requireOperationalContext, rejectTrip);
router.post("/trips/:tripId/complete", operationalRequestContext("trip.respond"), requireOperationalContext, completeTrip);
router.post("/trips/:tripId/cancel", operationalRequestContext("trip.edit_request"), requireOperationalContext, cancelTrip);
router.delete("/trips/:tripId", operationalRequestContext("trip.delete"), requireOperationalContext, deleteTrip);

// Quotation and approval workflow is part of the canonical trip resource. Each
// action resolves the same authorized operational context before touching data.
router.get("/trips/:tripId/quotation", operationalRequestContext("trip.read"), requireOperationalContext, getQuotation);
router.post("/trips/:tripId/quotation/submit", operationalRequestContext("trip.respond"), requireOperationalContext, submitQuotation);
router.post("/trips/:tripId/quotation/revise", operationalRequestContext("trip.respond"), requireOperationalContext, reviseQuotation);
router.post("/trips/:tripId/quotation/request-approval", operationalRequestContext("trip.request_quote_approval"), requireOperationalContext, requestApproval);
router.post("/trips/:tripId/quotation/approve", operationalRequestContext("trip.approve_quote"), requireOperationalContext, approveQuotation);
router.post("/trips/:tripId/quotation/request-changes", operationalRequestContext("trip.approve_quote"), requireOperationalContext, requestChanges);
router.post("/trips/:tripId/confirm", operationalRequestContext("trip.respond"), requireOperationalContext, confirmTrip);

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
