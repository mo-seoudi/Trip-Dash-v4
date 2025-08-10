// client/src/services/userService.js

import api from "./apiClient";

export const getPendingUsers = async () => {
  const { data } = await api.get("/admin/users/pending");
  return data;
};

export const approveUser = async (id) => {
  const { data } = await api.post(`/admin/users/${id}/approve`);
  return data;
};
