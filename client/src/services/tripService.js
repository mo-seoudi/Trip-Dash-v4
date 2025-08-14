// client/src/services/tripService.js
import api from "./apiClient";

/** Fetch all trips (optionally sort client-side like Firestore did) */
export const getAllTrips = async () => {
  const { data } = await api.get("/trips");
  return [...data].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

/** Fetch trips by user name (adjust query param/path to match your API) */
export const getTripsByUser = async (userName) => {
  const { data } = await api.get("/trips", { params: { createdBy: userName } });
  return [...data].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

/** Create a new trip */
export const createTrip = async (tripData) => {
  const { data } = await api.post("/trips", tripData);
  return data;
};

/** Update trip fields (partial) */
export const updateTrip = async (tripId, updates) => {
  const { data } = await api.patch(`/trips/${tripId}`, updates);
  return data;
};

/** Delete a trip */
export const deleteTrip = async (tripId) => {
  const { data } = await api.delete(`/trips/${tripId}`);
  return data; // or { ok: true } if your API returns no body
};

/** Assign buses and confirm trip (mirrors old behavior) */
export const assignBusesToTrip = async (tripId, buses) => {
  return await updateTrip(tripId, { buses, status: "Confirmed" });
};

/** Create sub-trips for each assigned bus */
export const createSubTrips = async (parentTripId, buses) => {
  const { data } = await api.post(`/trips/${parentTripId}/subtrips`, { buses });
  return data;
};

/** Get sub-trips for a trip */
export const getSubTripsByParent = async (parentTripId) => {
  const { data } = await api.get(`/trips/${parentTripId}/subtrips`);
  return [...data].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
};

/* ================================
 * Passengers (new feature)
 * ================================ */

/** Get passenger roster for a trip (requires auth + active org) */
export const getTripPassengers = async (tripId) => {
  const { data } = await api.get(`/trips/${tripId}/passengers`);
  return data.passengers || [];
};

/**
 * Add passengers to a trip.
 * @param {number} tripId
 * @param {Array<{fullName:string, grade?:string, guardianName?:string, guardianPhone?:string, pickupPoint?:string, dropoffPoint?:string, seatNumber?:string, notes?:string}>} items
 * @param {boolean} createDirectory - also create Passenger directory records
 */
export const addTripPassengers = async (tripId, items, createDirectory = true) => {
  const { data } = await api.post(`/trips/${tripId}/passengers`, { items, createDirectory });
  return data; // array of created TripPassenger rows
};

/**
 * Update a single passenger row on a trip (check-in/out, seat, etc.)
 * @param {number} tripId
 * @param {number} passengerRowId  - TripPassenger.id
 * @param {object} patch           - fields to update
 */
export const updateTripPassenger = async (tripId, passengerRowId, patch) => {
  const { data } = await api.patch(`/trips/${tripId}/passengers/${passengerRowId}`, patch);
  return data;
};

/**
 * Record a payment entry for a passenger on a paid trip.
 * @param {number} tripId
 * @param {number} passengerRowId  - TripPassenger.id
 * @param {{amountDue:number, amountPaid?:number, status?:'unpaid'|'partial'|'paid'|'waived', method?:string, reference?:string, currency?:string}} payload
 */
export const addTripPassengerPayment = async (tripId, passengerRowId, payload) => {
  const { data } = await api.post(`/trips/${tripId}/passengers/${passengerRowId}/payment`, payload);
  return data;
};
