import { createOperationalService } from "../../runtime/operationalService.js";
import { createPassengerService } from "./passengerService.js";

function service(req) {
  return createOperationalService(req.operational, createPassengerService);
}

export async function listPassengers(req, res, next) {
  try {
    return res.json({ data: await service(req).list(req.params.tripId) });
  } catch (error) { return next(error); }
}

export async function addPassengers(req, res, next) {
  try {
    return res.status(201).json({ data: await service(req).addMany(req.params.tripId, req.body || {}) });
  } catch (error) { return next(error); }
}

export async function updatePassenger(req, res, next) {
  try {
    return res.json({ data: await service(req).update(req.params.tripId, req.params.passengerId, req.body || {}) });
  } catch (error) { return next(error); }
}

export async function removePassenger(req, res, next) {
  try {
    await service(req).remove(req.params.tripId, req.params.passengerId);
    return res.status(204).end();
  } catch (error) { return next(error); }
}
