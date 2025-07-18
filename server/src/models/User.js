export default {
  userId: String,
  email: String,
  tenantId: String, // Main tenant context
  assignedSchools: [String], // For internal users
  allowedOrgIds: [String], // For external users like bus officers
  role: String,
  permissions: [String],
  isExternal: Boolean, // true for bus officers & external partners
};