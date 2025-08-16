// client/src/services/globalService.js
import api from "./apiClient";

// ---- session / org switcher ----
export const getMe = async () => (await api.get("/me")).data; // { user, orgs, active_org_id }
export const setActiveOrg = async (org_id) =>
  api.post("/session/set-org", { org_id }); // 204

// ---- tenants ----
export const listTenants = async () =>
  (await api.get("/global/tenants")).data;
export const createTenant = async (payload) =>
  (await api.post("/global/tenants", payload)).data;

// ---- orgs ----
export const listOrgs = async (tenant_id) =>
  (await api.get("/global/orgs", { params: { tenant_id } })).data;
export const createOrg = async (payload) =>
  (await api.post("/global/orgs", payload)).data;
export const updateOrg = async (id, patch) =>
  (await api.patch(`/global/orgs/${id}`, patch)).data;

// ---- partnerships ----
export const listPartnerships = async (tenant_id) =>
  (await api.get("/global/partnerships", { params: { tenant_id } })).data;
export const createPartnership = async (payload) =>
  (await api.post("/global/partnerships", payload)).data;
export const deletePartnership = async (id) =>
  (await api.delete(`/global/partnerships/${id}`)).data;
