import * as tripRepo from "../repositories/firebaseTripRepository.js";

// 🟢 Create trip
export async function createTrip(data, user) {
  const tripData = {
    ...data,
    organizationId: user.organizationId,
    schoolId: user.schoolId,
    requestedByUserId: user.id,
    totalPassengers: data.numberOfStudents + data.numberOfStaff,
    status: "Pending",
  };

  const trip = await tripRepo.createTrip(tripData);
  return trip;
}

// 🟢 Update trip status with tenant check
export async function updateStatus(tripId, newStatus, user) {
  const trip = await tripRepo.findTripById(tripId);
  if (!trip || trip.organizationId !== user.organizationId) {
    throw new Error("Trip not found or access denied");
  }

  const updated = await tripRepo.updateTripStatus(tripId, newStatus);
  return updated;
}

// 🟢 Assign bus with tenant check
export async function assignBus(tripId, busData, user) {
  const trip = await tripRepo.findTripById(tripId);
  if (!trip || trip.organizationId !== user.organizationId) {
    throw new Error("Trip not found or access denied");
  }

  const updated = await tripRepo.assignBus(tripId, busData);
  return updated;
}

// 🟢 Get trips for an organization
export async function getTrips(user) {
  const trips = await tripRepo.findTripsByOrganization(user.organizationId);
  return trips;
}
