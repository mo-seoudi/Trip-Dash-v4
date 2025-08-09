// src/services/tripService.js
import api from "./apiClient";

/** Fetch all trips (optionally sort client-side like Firestore did) */
export const getAllTrips = async () => {
  const { data } = await api.get("/trips");
  // If backend doesn’t sort, do what Firestore did:
  return [...data].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
};

/** Fetch trips by user name (adjust query param/path to match your API) */
export const getTripsByUser = async (userName) => {
  // Option A: /trips?createdBy=<userName>
  const { data } = await api.get("/trips", { params: { createdBy: userName } });
  return [...data].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
  // Option B (if your server uses a different route):
  // const { data } = await api.get(`/users/${encodeURIComponent(userName)}/trips`);
  // return data;
};

/** Create a new trip */
export const createTrip = async (tripData) => {
  const { data } = await api.post("/trips", tripData);
  return data;
};

/** Update trip fields (partial) */
export const updateTrip = async (tripId, updates) => {
  // If your API expects PUT instead of PATCH, switch to api.put
  const { data } = await api.patch(`/trips/${tripId}`, updates);
  return data;
};

/** Delete a trip */
export const deleteTrip = async (tripId) => {
  const { data } = await api.delete(`/trips/${tripId}`);
  return data; // or return { ok: true } if your API returns no body
};

/** Assign buses and confirm trip (mirrors old behavior) */
export const assignBusesToTrip = async (tripId, buses) => {
  return await updateTrip(tripId, { buses, status: "Confirmed" });
};

/** Create sub-trips for each assigned bus */
export const createSubTrips = async (parentTripId, buses) => {
  // Expecting backend to create many; adjust if it’s one-at-a-time
  const { data } = await api.post(`/trips/${parentTripId}/subtrips`, { buses });
  return data;
};

/** Get sub-trips for a trip */
export const getSubTripsByParent = async (parentTripId) => {
  const { data } = await api.get(`/trips/${parentTripId}/subtrips`);
  // Keep Firestore’s ascending createdAt for subTrips
  return [...data].sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
  );
};
