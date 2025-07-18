import * as tripService from "../services/tripService.js";
import logger from "../utils/logger.js";

export async function createTrip(req, res, next) {
  try {
    const trip = await tripService.createTrip(req.body, req.user, req.requestId);
    logger.info({ requestId: req.requestId, userId: req.user.id, tripId: trip.id }, "✅ Trip created successfully");
    res.status(201).json(trip);
  } catch (err) {
    logger.error({ requestId: req.requestId, error: err, userId: req.user?.id }, "❌ Error creating trip");
    next(err);
  }
}

export async function updateStatus(req, res, next) {
  try {
    const updatedTrip = await tripService.updateStatus(req.params.id, req.body.status, req.user, req.requestId);
    logger.info({ requestId: req.requestId, userId: req.user.id, tripId: req.params.id, status: req.body.status }, "✅ Trip status updated");
    res.status(200).json(updatedTrip);
  } catch (err) {
    logger.error({ requestId: req.requestId, error: err, userId: req.user?.id, tripId: req.params.id }, "❌ Error updating trip status");
    next(err);
  }
}

export async function assignBus(req, res, next) {
  try {
    const updatedTrip = await tripService.assignBus(req.params.id, req.body, req.user, req.requestId);
    logger.info({ requestId: req.requestId, userId: req.user.id, tripId: req.params.id }, "✅ Bus assigned to trip");
    res.status(200).json(updatedTrip);
  } catch (err) {
    logger.error({ requestId: req.requestId, error: err, userId: req.user?.id, tripId: req.params.id }, "❌ Error assigning bus");
    next(err);
  }
}

export async function getTrips(req, res, next) {
  try {
    const trips = await tripService.getTrips(req.user, req.requestId);
    logger.info({ requestId: req.requestId, userId: req.user.id, tripsCount: trips.length }, "✅ Retrieved trips");
    res.status(200).json(trips);
  } catch (err) {
    logger.error({ requestId: req.requestId, error: err, userId: req.user?.id }, "❌ Error retrieving trips");
    next(err);
  }
}
