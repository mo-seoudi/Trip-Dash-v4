import { getOrganizationRepository } from "./repositoryResolver.js";

export async function createOrganization(tenantConfig, orgData) {
  const orgRepo = getOrganizationRepository(tenantConfig);
  return await orgRepo.insert(orgData);
}

export async function getOrganizationById(tenantConfig, orgId) {
  const orgRepo = getOrganizationRepository(tenantConfig);
  return await orgRepo.getById(orgId);
}

export async function listOrganizations(tenantConfig) {
  const orgRepo = getOrganizationRepository(tenantConfig);
  return await orgRepo.list();
}