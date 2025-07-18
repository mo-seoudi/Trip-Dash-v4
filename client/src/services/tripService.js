
const API_BASE = import.meta.env.REACT_APP_API_URL || "/api";

const getAuthHeader = () => {
  const token = localStorage.getItem("token");
  return {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json"
  };
};

export const getAllTrips = async () => {
  const res = await fetch(`${API_BASE}/trips`, {
    headers: getAuthHeader(),
  });
  return await res.json();
};

export const getTripsByUser = async (userName) => {
  const res = await fetch(`${API_BASE}/trips?createdBy=${userName}`, {
    headers: getAuthHeader(),
  });
  return await res.json();
};

export const createTrip = async (tripData) => {
  const res = await fetch(`${API_BASE}/trips`, {
    method: "POST",
    headers: getAuthHeader(),
    body: JSON.stringify(tripData)
  });
  return await res.json();
};

export const updateTrip = async (tripId, updates) => {
  const res = await fetch(`${API_BASE}/trips/${tripId}`, {
    method: "PUT",
    headers: getAuthHeader(),
    body: JSON.stringify(updates)
  });
  return await res.json();
};

export const deleteTrip = async (tripId) => {
  const res = await fetch(`${API_BASE}/trips/${tripId}`, {
    method: "DELETE",
    headers: getAuthHeader(),
  });
  return await res.json();
};

export const assignBusesToTrip = async (tripId, buses) => {
  const res = await fetch(`${API_BASE}/trips/${tripId}/assign-buses`, {
    method: "POST",
    headers: getAuthHeader(),
    body: JSON.stringify({ buses })
  });
  return await res.json();
};

export const createSubTrips = async (parentTripId, buses) => {
  const res = await fetch(`${API_BASE}/subtrips`, {
    method: "POST",
    headers: getAuthHeader(),
    body: JSON.stringify({ parentTripId, buses })
  });
  return await res.json();
};

export const getSubTripsByParent = async (parentTripId) => {
  const res = await fetch(`${API_BASE}/subtrips?parentTripId=${parentTripId}`, {
    headers: getAuthHeader(),
  });
  return await res.json();
};
