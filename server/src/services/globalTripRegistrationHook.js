// Explicitly opt-in only AFTER both reviewed migrations are applied.
// This hook is best-effort; failures are logged for a durable reconciliation
// job to retry. It must never turn a successfully created trip into an HTTP 500.
import { reconcileGlobalTrip } from "./globalTripRegistryService.js";

export function globalTripRegistrationEnabled() {
  return process.env.GLOBAL_TRIP_REGISTRATION_ENABLED === "true";
}

export async function registerCreatedTrips({ schoolId, tripIds, reconcile = reconcileGlobalTrip, logger = console }) {
  if (!globalTripRegistrationEnabled()) return { enabled: false, registered: 0, failed: 0 };
  const ids = [...new Set(tripIds.filter(id => Number.isSafeInteger(id) && id > 0))];
  const results = await Promise.allSettled(ids.map(localTripId => reconcile({ schoolId, localTripId })));
  const failed = results.filter(result => result.status === "rejected");
  for (const result of failed) logger.error("Global trip registration requires reconciliation", {
    schoolId, code: result.reason?.code || "REGISTRATION_FAILED",
  });
  return { enabled: true, registered: results.length - failed.length, failed: failed.length };
}
