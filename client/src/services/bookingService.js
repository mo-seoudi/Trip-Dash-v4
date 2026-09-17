import api from "./apiClient";
const school = value => { const id=String(value||"").trim(); if(!id) throw new Error("A school workspace is required for bookings"); return encodeURIComponent(id); };
const base = schoolId => `/workspaces/${school(schoolId)}/bookings`;
export const listBookings=async schoolId=>(await api.get(base(schoolId))).data;
export const createBooking=async(schoolId,payload)=>(await api.post(base(schoolId),payload)).data;
export const updateBooking=async(schoolId,id,patch)=>(await api.patch(`${base(schoolId)}/${id}`,patch)).data;
export const deleteBooking=async(schoolId,id)=>(await api.delete(`${base(schoolId)}/${id}`)).data;
