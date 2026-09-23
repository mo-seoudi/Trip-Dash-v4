import { createOperationalService } from "../../runtime/operationalService.js";
import { createTripService } from "./tripService.js";

function service(req) {
  return createOperationalService(req.operational, createTripService);
}

export async function listTrips(req, res, next) {
  try {
    const trips = await service(req).list({ status: req.query.status, from: req.query.from, to: req.query.to, take: req.query.take });
    return res.json({ data: trips });
  } catch (error) { return next(error); }
}

export async function getTrip(req, res, next) {
  try { return res.json({ data: await service(req).get(req.params.tripId) }); }
  catch (error) { return next(error); }
}

export async function createTrip(req, res, next) {
  try { return res.status(201).json({ data: await service(req).create(req.body || {}) }); }
  catch (error) { return next(error); }
}

export async function updateTrip(req, res, next) {
  try { return res.json({ data: await service(req).update(req.params.tripId, req.body || {}) }); }
  catch (error) { return next(error); }
}

export async function acceptTrip(req, res, next) {
  try { return res.json({ data: await service(req).accept(req.params.tripId) }); }
  catch (error) { return next(error); }
}

export async function rejectTrip(req, res, next) {
  try { return res.json({ data: await service(req).reject(req.params.tripId) }); }
  catch (error) { return next(error); }
}

export async function completeTrip(req, res, next) {
  try { return res.json({ data: await service(req).complete(req.params.tripId) }); }
  catch (error) { return next(error); }
}

export async function cancelTrip(req, res, next) {
  try { return res.json({ data: await service(req).cancel(req.params.tripId) }); }
  catch (error) { return next(error); }
}

export async function requestTripCancellation(req, res, next) {
  try { return res.json({ data: await service(req).requestCancellation(req.params.tripId) }); }
  catch (error) { return next(error); }
}

export async function resolveTripCancellation(req, res, next) {
  try {
    if (typeof req.body?.approve !== "boolean") return res.status(400).json({ message: "approve must be true or false" });
    return res.json({ data: await service(req).resolveCancellation(req.params.tripId, req.body.approve) });
  } catch (error) { return next(error); }
}

export async function deleteTrip(req, res, next) {
  try { return res.json({ data: await service(req).remove(req.params.tripId) }); }
  catch (error) { return next(error); }
}
