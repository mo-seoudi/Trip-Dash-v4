import api from "./apiClient";

const school = value => {
  const id = String(value || "").trim();
  if (!id) throw new Error("A school workspace is required for recurring bookings");
  return encodeURIComponent(id);
};

const base = schoolId => `/workspaces/${school(schoolId)}/trip-series`;

export const listRecurringBookings = async schoolId => (await api.get(base(schoolId))).data;
export const getRecurringBooking = async (schoolId, id) => (await api.get(`${base(schoolId)}/${encodeURIComponent(id)}`)).data;
export const createRecurringBooking = async (schoolId, payload) => (await api.post(base(schoolId), payload)).data;
