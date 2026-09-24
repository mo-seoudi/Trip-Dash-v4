import { prismaControl } from "../../lib/prismaControl.js";
import { createOperationalService } from "../../runtime/operationalService.js";
import { createTripService } from "./tripService.js";

function service(req) {
  return createOperationalService(req.operational, createTripService);
}

async function attachRequesterIdentity(value) {
  const trips = (Array.isArray(value) ? value : [value]).filter(Boolean);
  const ids = [...new Set(trips.map((trip) => trip.createdByAppUserId).filter(Boolean))];
  if (!ids.length) return value;

  const users = await prismaControl.appUser.findMany({
    where: { id: { in: ids } },
    select: { id: true, displayName: true, email: true },
  });
  const byId = new Map(users.map((user) => [user.id, user]));
  const enriched = trips.map((trip) => {
    const creator = byId.get(trip.createdByAppUserId);
    return creator ? { ...trip, createdByName: creator.displayName || creator.email, createdByEmail: creator.email } : trip;
  });
  return Array.isArray(value) ? enriched : enriched[0];
}

async function respondWithTrip(res, promise, status = 200) {
  const trip = await promise;
  return res.status(status).json({ data: await attachRequesterIdentity(trip) });
}

export async function listTrips(req, res, next) {
  try {
    const trips = await service(req).list({ status: req.query.status, from: req.query.from, to: req.query.to, take: req.query.take });
    return res.json({ data: await attachRequesterIdentity(trips) });
  } catch (error) { return next(error); }
}

export async function getTrip(req, res, next) {
  try { return await respondWithTrip(res, service(req).get(req.params.tripId)); }
  catch (error) { return next(error); }
}

export async function createTrip(req, res, next) {
  try { return await respondWithTrip(res, service(req).create(req.body || {}), 201); }
  catch (error) { return next(error); }
}

export async function updateTrip(req, res, next) {
  try { return await respondWithTrip(res, service(req).update(req.params.tripId, req.body || {})); }
  catch (error) { return next(error); }
}

export async function acceptTrip(req, res, next) {
  try { return await respondWithTrip(res, service(req).accept(req.params.tripId)); }
  catch (error) { return next(error); }
}

export async function rejectTrip(req, res, next) {
  try { return await respondWithTrip(res, service(req).reject(req.params.tripId)); }
  catch (error) { return next(error); }
}

export async function completeTrip(req, res, next) {
  try { return await respondWithTrip(res, service(req).complete(req.params.tripId)); }
  catch (error) { return next(error); }
}

export async function cancelTrip(req, res, next) {
  try { return await respondWithTrip(res, service(req).cancel(req.params.tripId)); }
  catch (error) { return next(error); }
}

export async function requestTripCancellation(req, res, next) {
  try { return await respondWithTrip(res, service(req).requestCancellation(req.params.tripId)); }
  catch (error) { return next(error); }
}

export async function resolveTripCancellation(req, res, next) {
  try {
    if (typeof req.body?.approve !== "boolean") return res.status(400).json({ message: "approve must be true or false" });
    return await respondWithTrip(res, service(req).resolveCancellation(req.params.tripId, req.body.approve));
  } catch (error) { return next(error); }
}

export async function deleteTrip(req, res, next) {
  try { return res.json({ data: await service(req).remove(req.params.tripId) }); }
  catch (error) { return next(error); }
}
