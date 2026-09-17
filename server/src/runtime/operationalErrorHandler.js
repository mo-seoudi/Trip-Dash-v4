import { OperationalAuthorizationError } from "../services/authorizedOperationalContext.js";
import { OperationalServiceContextError } from "./operationalService.js";
import { TripNotFoundError, TripValidationError } from "../domain/trips/tripService.js";
import { PassengerNotFoundError } from "../domain/trips/passengerService.js";
import { BusAssignmentNotFoundError, PassengerAllocationConflictError } from "../domain/trips/passengerAllocationService.js";

export function operationalErrorHandler(error, _req, res, next) {
  const known =
    error instanceof OperationalAuthorizationError ||
    error instanceof OperationalServiceContextError ||
    error instanceof TripValidationError ||
    error instanceof TripNotFoundError ||
    error instanceof PassengerNotFoundError ||
    error instanceof BusAssignmentNotFoundError ||
    error instanceof PassengerAllocationConflictError;

  if (!known) return next(error);

  const status = Number(error.status) || (error instanceof OperationalServiceContextError ? 500 : 400);
  return res.status(status).json({
    error: error.code || "OPERATIONAL_REQUEST_FAILED",
    message: error.message,
    ...(error.field ? { field: error.field } : {}),
  });
}
