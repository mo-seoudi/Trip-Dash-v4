import { createOperationalService } from "../../runtime/operationalService.js";
import { createPassengerAllocationService } from "./passengerAllocationService.js";

function service(req) {
  return createOperationalService(req.operational, createPassengerAllocationService);
}

export async function listPassengerAllocations(req, res, next) {
  try { return res.json({ data: await service(req).list(req.params.tripId) }); }
  catch (error) { return next(error); }
}

export async function allocatePassenger(req, res, next) {
  try {
    const data = await service(req).allocate(req.params.tripId, req.params.busAssignmentId, req.params.passengerId);
    return res.status(201).json({ data });
  } catch (error) { return next(error); }
}

export async function movePassenger(req, res, next) {
  try {
    const data = await service(req).move(req.params.tripId, req.params.passengerId, req.body?.busAssignmentId);
    return res.json({ data });
  } catch (error) { return next(error); }
}

export async function unallocatePassenger(req, res, next) {
  try {
    await service(req).unallocate(req.params.tripId, req.params.passengerId);
    return res.status(204).end();
  } catch (error) { return next(error); }
}
