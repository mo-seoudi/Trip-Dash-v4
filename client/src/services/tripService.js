// client/src/services/tripService.js
import api from "./apiClient";

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

// Trips
export const getAllTrips = async () => {
  const { data } = await api.get("/trips");
  return data.map(normalizeTrip).sort(sortTrips);
};
export const getTripsByUser = async (name) => {
  const { data } = await api.get("/trips", { params: { createdBy: name } });
  return data.map(normalizeTrip).sort(sortTrips);
};
export const createTrip = async (payload) => {
  const { data } = await api.post("/trips", payload);
  return normalizeTrip(data);
};
export const updateTrip = async (tripId, patch) => {
  const { data } = await api.patch(`/trips/${tripId}`, patch);
  return normalizeTrip(data);
};
export const deleteTrip = async (tripId) => {
  const { data } = await api.delete(`/trips/${tripId}`);
  return data;
};

// Sub-trips (unchanged)
export const createSubTrips = async (parentTripId, buses) => {
  const { data } = await api.post(`/trips/${parentTripId}/subtrips`, { buses });
  return data;
};
export const getSubTripsByParent = async (parentTripId) => {
  const { data } = await api.get(`/trips/${parentTripId}/subtrips`);
  return [...data].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
};

// Passengers
export const getTripPassengers = async (tripId) => {
  const { data } = await api.get(`/trips/${tripId}/passengers`);
  return Array.isArray(data) ? data : [];
};

export const addTripPassengers = async (tripId, passengers) => {
  const { data } = await api.post(`/trips/${tripId}/passengers`, { passengers });
  return Array.isArray(data) ? data : [];
};

// (You can add updateTripPassenger, addTripPassengerPayment later if needed)
