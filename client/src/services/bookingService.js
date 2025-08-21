// client/src/services/bookingService.js

import api from "./apiClient";

export const listBookings = async (createdBy) => {
  const { data } = await api.get("/bookings", {
    params: createdBy ? { createdBy } : undefined,
  });
  return data;
};

export const createBooking = async (payload) => {
  const { data } = await api.post("/bookings", payload);
  return data;
};

export const updateBooking = async (id, patch) => {
  const { data } = await api.patch(`/bookings/${id}`, patch);
  return data;
};

export const deleteBooking = async (id) => {
  const { data } = await api.delete(`/bookings/${id}`);
  return data;
};
