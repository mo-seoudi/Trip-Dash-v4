// client/src/services/accessService.js
import api from "./apiClient";

/* lookups */
export const listTenants = async () => (await api.get("/global/tenants")).data;
export const listOrgs    = async (tenant_id) => (await api.get("/global/orgs", { params: { tenant_id } })).data;
export const listSchools = async (tenant_id) => (await api.get("/global/orgs", { params: { tenant_id } })).data
  .then(rows => rows.filter(o => o.type === "school"));

/* users */
export const searchUsers = async (q) => (await api.get("/global/users", { params: { q } })).data;

/* grants (roles + scopes) */
export const getUserGrants = async (user_id) =>
  (await api.get(`/global/users/${user_id}/grants`)).data;

export const grantRole = async (user_id, payload) =>
  (await api.post(`/global/users/${user_id}/roles`, payload)).data;

export const revokeRole = async (user_id, payload) =>
  (await api.delete(`/global/users/${user_id}/roles`, { data: payload })).data;

export const addScope = async (user_id, payload) =>
  (await api.post(`/global/users/${user_id}/scopes`, payload)).data;

export const removeScope = async (user_id, payload) =>
  (await api.delete(`/global/users/${user_id}/scopes`, { data: payload })).data;
