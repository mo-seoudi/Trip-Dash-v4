import { createOperationalService } from "../../runtime/operationalService.js";
import { createTripService } from "./tripService.js";

function service(req) {
  return createOperationalService(req.operational, createTripService);
}

export async function listTrips(req, res, next) {
  try {
    const trips = await service(req).list({
      status: req.query.status,
      from: req.query.from,
      to: req.query.to,
      take: req.query.take,
    });
    return res.json({ data: trips });
  } catch (error) {
    return next(error);
  }
}

export async function getTrip(req, res, next) {
  try {
    const trip = await service(req).get(req.params.tripId);
    return res.json({ data: trip });
  } catch (error) {
    return next(error);
  }
}

export async function createTrip(req, res, next) {
  try {
    const trip = await service(req).create(req.body || {});
    return res.status(201).json({ data: trip });
  } catch (error) {
    return next(error);
  }
}
