export default {
  organizationId: String,
  tenantId: String, // Link to owning tenant
  name: String,
  campuses: [String], // Optional: if org has multiple campuses
  description: String,
};