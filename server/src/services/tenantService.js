import { getTenantRepository } from "./repositoryResolver.js";

// Example: Load tenant config from request context, header, or static DB.
export async function getTenantById(tenantId, tenantConfig) {
  const tenantRepo = getTenantRepository(tenantConfig);
  const tenant = await tenantRepo.getTenantById(tenantId);
  if (!tenant) {
    throw new Error("Tenant not found");
  }
  return tenant;
}

export async function createTenant(data, tenantConfig) {
  const tenantRepo = getTenantRepository(tenantConfig);
  return await tenantRepo.createTenant(data);
}

export async function updateTenant(tenantId, updates, tenantConfig) {
  const tenantRepo = getTenantRepository(tenantConfig);
  return await tenantRepo.updateTenant(tenantId, updates);
}

export async function deleteTenant(tenantId, tenantConfig) {
  const tenantRepo = getTenantRepository(tenantConfig);
  return await tenantRepo.deleteTenant(tenantId);
}

export async function listTenants(tenantConfig) {
  const tenantRepo = getTenantRepository(tenantConfig);
  return await tenantRepo.listTenants();
}

/**
 * Example function: get tenant config
 * This is what was missing before!
 * You can customize how this is resolved (e.g., from DB, header, JWT claims, etc.)
 */
export function getTenantConfig(tenantId) {
  // Example: In real setup, fetch from DB or cache using tenantId
  return {
    type: "sql",
    url: "mysql://user:pass@host/dbname",
    options: { logging: false },
  };
}
