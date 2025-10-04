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

/** Trips */
export const getAllTrips = async () => {
  const { data } = await api.get("/trips");
  return data.map(normalizeTrip).sort(sortTrips);
};

export const getTripsByUser = async (userName) => {
  const { data } = await api.get("/trips", { params: { createdBy: userName } });
  return data.map(normalizeTrip).sort(sortTrips);
};

export const createTrip = async (tripData) => {
  const { data } = await api.post("/trips", tripData);
  return normalizeTrip(data);
};

export const updateTrip = async (tripId, updates) => {
  const { data } = await api.patch(`/trips/${tripId}`, updates);
  return normalizeTrip(data);
};

export const deleteTrip = async (tripId) => {
  const { data } = await api.delete(`/trips/${tripId}`);
  return data;
};

export const assignBusesToTrip = async (tripId, buses) =>
  updateTrip(tripId, { buses, status: "Confirmed" });

export const createSubTrips = async (parentTripId, buses) => {
  const { data } = await api.post(`/trips/${parentTripId}/subtrips`, { buses });
  return data;
};

export const getSubTripsByParent = async (parentTripId) => {
  const { data } = await api.get(`/trips/${parentTripId}/subtrips`);
  return [...data].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
};

/** Passengers */
export const getTripPassengers = async (tripId) => {
  const { data } = await api.get(`/trips/${tripId}/passengers`);
  // backend returns an array directly
  return Array.isArray(data) ? data : [];
};

export const addTripPassengers = async (tripId, items, _createDirectory = true) => {
  // backend expects: { passengers: [...] }
  const { data } = await api.post(`/trips/${tripId}/passengers`, {
    passengers: items,
  });
  return Array.isArray(data) ? data : [];
};

export const updateTripPassenger = async (tripId, passengerRowId, patch) => {
  const { data } = await api.patch(`/trips/${tripId}/passengers/${passengerRowId}`, patch);
  return data;
};

export const addTripPassengerPayment = async (tripId, passengerRowId, payload) => {
  const { data } = await api.post(`/trips/${tripId}/passengers/${passengerRowId}/payment`, payload);
  return data;
};
