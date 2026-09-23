// client/src/services/tripService.js
import api from "./apiClient";

const toYMD = (date) => {
  if (!date) return date;
  if (date instanceof Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  if (typeof date === "string" && date.includes("T")) return date.slice(0, 10);
  return date;
};

const normalizeTrip = (trip) => ({
  ...trip,
  date: trip?.date ? new Date(trip.date) : null,
  returnDate: trip?.returnDate ? new Date(trip.returnDate) : null,
});

const sortTrips = (a, b) => {
  if (typeof a.id === "number" && typeof b.id === "number") return b.id - a.id;
  if (a.createdAt && b.createdAt) return new Date(b.createdAt) - new Date(a.createdAt);
  return 0;
};

const serializeUpdates = (updates = {}) => {
  const payload = { ...updates };
  if (payload.date !== undefined) payload.date = toYMD(payload.date);
  if (payload.returnDate !== undefined) payload.returnDate = toYMD(payload.returnDate);
  return payload;
};

const requireSchoolId = (schoolId) => {
  const id = String(schoolId || "").trim();
  if (!id) throw new Error("A school workspace is required for this operation");
  return encodeURIComponent(id);
};

const unwrapData = (response) => response?.data?.data ?? response?.data;
const unwrapList = (response) => {
  const value = unwrapData(response);
  return Array.isArray(value) ? value : [];
};

const workspaceTripsPath = (schoolId) => `/workspaces/${requireSchoolId(schoolId)}/trips`;
const workspaceTripPath = (schoolId, tripId) => `${workspaceTripsPath(schoolId)}/${tripId}`;
const workspaceBusAssignmentsPath = (schoolId, tripId) => `${workspaceTripPath(schoolId, tripId)}/bus-assignments`;
const workspacePassengersPath = (schoolId, tripId) => `${workspaceTripPath(schoolId, tripId)}/passengers`;
const workspaceWorkflowPath = (schoolId, tripId) => `${workspaceTripPath(schoolId, tripId)}/workflow`;
const lifecycleAction = async (schoolId, tripId, action) =>
  normalizeTrip(unwrapData(await api.post(`${workspaceTripPath(schoolId, tripId)}/${action}`)));

export const getWorkspaceTrips = async (schoolId) =>
  unwrapList(await api.get(workspaceTripsPath(schoolId))).map(normalizeTrip).sort(sortTrips);
export const getWorkspaceTrip = async (schoolId, tripId) => normalizeTrip(unwrapData(await api.get(workspaceTripPath(schoolId, tripId))));
export const createWorkspaceTrip = async (schoolId, payload) => normalizeTrip(unwrapData(await api.post(workspaceTripsPath(schoolId), serializeUpdates(payload))));
export const updateWorkspaceTrip = async (schoolId, tripId, payload) => normalizeTrip(unwrapData(await api.patch(workspaceTripPath(schoolId, tripId), serializeUpdates(payload))));
export const deleteWorkspaceTrip = async (schoolId, tripId) => unwrapData(await api.delete(workspaceTripPath(schoolId, tripId)));

export const getWorkspaceBusAssignments = async (schoolId, tripId) => unwrapList(await api.get(workspaceBusAssignmentsPath(schoolId, tripId)));
export const createWorkspaceBusAssignment = async (schoolId, tripId, payload) => unwrapData(await api.post(workspaceBusAssignmentsPath(schoolId, tripId), payload));
export const updateWorkspaceBusAssignment = async (schoolId, tripId, assignmentId, payload) => unwrapData(await api.patch(`${workspaceBusAssignmentsPath(schoolId, tripId)}/${assignmentId}`, payload));
export const updateWorkspaceBusAssignmentCommercials = async (schoolId, tripId, assignmentId, payload) => unwrapData(await api.patch(`${workspaceBusAssignmentsPath(schoolId, tripId)}/${assignmentId}/commercial`, payload));
export const deleteWorkspaceBusAssignment = async (schoolId, tripId, assignmentId) => { await api.delete(`${workspaceBusAssignmentsPath(schoolId, tripId)}/${assignmentId}`); };

export const getWorkspaceQuotation = async (schoolId, tripId) => unwrapData(await api.get(`${workspaceWorkflowPath(schoolId, tripId)}/quotation`));
export const submitWorkspaceQuotation = async (schoolId, tripId) => unwrapData(await api.post(`${workspaceWorkflowPath(schoolId, tripId)}/submit-quotation`));
export const reviseWorkspaceQuotation = async (schoolId, tripId, reason) => unwrapData(await api.post(`${workspaceWorkflowPath(schoolId, tripId)}/revise-quotation`, { reason }));
export const getWorkspaceQuotationApprovers = async (schoolId) => unwrapList(await api.get(`/access/workspaces/${requireSchoolId(schoolId)}/quotation-approvers`));
export const requestWorkspaceQuotationApproval = async (schoolId, tripId, payload) => unwrapData(await api.post(`${workspaceWorkflowPath(schoolId, tripId)}/request-approval`, payload));
export const approveWorkspaceQuotation = async (schoolId, tripId) => unwrapData(await api.post(`${workspaceWorkflowPath(schoolId, tripId)}/approve-quotation`));
export const requestWorkspaceQuotationChanges = async (schoolId, tripId, reason) => unwrapData(await api.post(`${workspaceWorkflowPath(schoolId, tripId)}/request-changes`, { reason }));

// Core lifecycle transitions now go through the canonical scoped trip API.
export const acceptWorkspaceTrip = async (schoolId, tripId) => lifecycleAction(schoolId, tripId, "accept");
export const rejectWorkspaceTrip = async (schoolId, tripId) => lifecycleAction(schoolId, tripId, "reject");
export const completeWorkspaceTrip = async (schoolId, tripId) => lifecycleAction(schoolId, tripId, "complete");
export const cancelWorkspaceTrip = async (schoolId, tripId) => lifecycleAction(schoolId, tripId, "cancel");

// Quotation confirmation and post-acceptance cancellation remain workflow-level
// actions because they coordinate records beyond the core Trip lifecycle service.
export const confirmWorkspaceTrip = async (schoolId, tripId) => unwrapData(await api.post(`${workspaceWorkflowPath(schoolId, tripId)}/confirm`));
export const requestWorkspaceTripCancellation = async (schoolId, tripId) => normalizeTrip(unwrapData(await api.post(`${workspaceWorkflowPath(schoolId, tripId)}/request-cancel`)));
export const resolveWorkspaceTripCancellation = async (schoolId, tripId, approve) => normalizeTrip(unwrapData(await api.post(`${workspaceWorkflowPath(schoolId, tripId)}/resolve-cancel`, { approve })));

export const getWorkspaceTripPassengers = async (schoolId, tripId) => unwrapList(await api.get(workspacePassengersPath(schoolId, tripId)));
export const addWorkspaceTripPassengers = async (schoolId, tripId, passengers) => unwrapData(await api.post(workspacePassengersPath(schoolId, tripId), { passengers }));
export const updateWorkspaceTripPassenger = async (schoolId, tripId, passengerId, payload) => unwrapData(await api.patch(`${workspacePassengersPath(schoolId, tripId)}/${passengerId}`, payload));
export const deleteWorkspaceTripPassenger = async (schoolId, tripId, passengerId) => { await api.delete(`${workspacePassengersPath(schoolId, tripId)}/${passengerId}`); };
