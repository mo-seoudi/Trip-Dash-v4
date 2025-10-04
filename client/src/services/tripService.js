// client/src/services/tripService.js
import api from "./apiClient";

// normalize dates once so the rest of the app can treat them as Date objects
const normalizeTrip = (t) => ({
  ...t,
  date: t?.date ? new Date(t.date) : null,
  returnDate: t?.returnDate ? new Date(t.returnDate) : null,
});

const sortTrips = (a, b) => {
  if (typeof a.id === "number" && typeof b.id === "number") return b.id - a.id;
  if (a.createdAt && b.createdAt) return new Date(b.createdAt) - new Date(a.createdAt);
  return 0;
};

/** Fetch all trips */
export const getAllTrips = async () => {
  const { data } = await api.get("/trips");
  return data.map(normalizeTrip).sort(sortTrips);
};

/** Fetch trips by user name */
export const getTripsByUser = async (userName) => {
  const { data } = await api.get("/trips", { params: { createdBy: userName } });
  return data.map(normalizeTrip).sort(sortTrips);
};

/** Create a new trip */
export const createTrip = async (tripData) => {
  const { data } = await api.post("/trips", tripData);
  return normalizeTrip(data);
};

/** Update trip fields (partial) */
export const updateTrip = async (tripId, updates) => {
  const { data } = await api.patch(`/trips/${tripId}`, updates);
  return normalizeTrip(data);
};

/** Delete a trip */
export const deleteTrip = async (tripId) => {
  const { data } = await api.delete(`/trips/${tripId}`);
  return data;
};

/** Assign buses and confirm trip */
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

/* =============== Passengers ================= */

/** Get passenger roster for a trip (server returns an array) */
export const getTripPassengers = async (tripId) => {
  const { data } = await api.get(`/trips/${tripId}/passengers`);
  return Array.isArray(data) ? data : (data?.passengers || []);
};

/** Add passengers to a trip (server expects { passengers: [...] }) */
export const addTripPassengers = async (tripId, passengers) => {
  const { data } = await api.post(`/trips/${tripId}/passengers`, { passengers });
  return Array.isArray(data) ? data : (data?.passengers || []);
};

export const updateTripPassenger = async (tripId, passengerRowId, patch) => {
  const { data } = await api.patch(`/trips/${tripId}/passengers/${passengerRowId}`, patch);
  return data;
};

export const addTripPassengerPayment = async (tripId, passengerRowId, payload) => {
  const { data } = await api.post(`/trips/${tripId}/passengers/${passengerRowId}/payment`, payload);
  return data;
};

