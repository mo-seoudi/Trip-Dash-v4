import { getTripRepository } from "./repositoryResolver.js";
import { getTenantConfig } from "./tenantService.js";
import logger from "../utils/logger.js";

export async function createTrip(data, user, requestId) {
  const tenant = await getTenantConfig(user.tenantId);
  const tripRepo = getTripRepository(tenant);

  const tripData = {
    ...data,
    organizationId: user.organizationId,
    schoolId: user.schoolId,
    requestedByUserId: user.id,
    totalPassengers: data.numberOfStudents + data.numberOfStaff,
    status: "Pending",
  };

  logger.info({ requestId, userId: user.id }, "Preparing to create trip in repo");
  const trip = await tripRepo.createTrip(tripData);
  return trip;
}

export async function updateStatus(tripId, newStatus, user, requestId) {
  const tenant = await getTenantConfig(user.tenantId);
  const tripRepo = getTripRepository(tenant);

  const trip = await tripRepo.findTripById(tripId);
  if (!trip || trip.organizationId !== user.organizationId) {
    throw new Error("Trip not found or access denied");
  }

  logger.info({ requestId, userId: user.id, tripId }, "Updating trip status in repo");
  const updated = await tripRepo.updateTripStatus(tripId, newStatus);
  return updated;
}

export async function assignBus(tripId, busData, user, requestId) {
  const tenant = await getTenantConfig(user.tenantId);
  const tripRepo = getTripRepository(tenant);

  const trip = await tripRepo.findTripById(tripId);
  if (!trip || trip.organizationId !== user.organizationId) {
    throw new Error("Trip not found or access denied");
  }

  logger.info({ requestId, userId: user.id, tripId }, "Assigning bus in repo");
  const updated = await tripRepo.assignBus(tripId, busData);
  return updated;
}

export async function getTrips(user, requestId) {
  const tenant = await getTenantConfig(user.tenantId);
  const tripRepo = getTripRepository(tenant);

  logger.info({ requestId, userId: user.id }, "Fetching trips for organization");
  const trips = await tripRepo.findTripsByOrganization(user.organizationId);
  return trips;
}
