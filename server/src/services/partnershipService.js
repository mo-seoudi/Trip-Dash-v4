import { getPartnershipRepository, getUserRepository } from "./repositoryResolver.js";

export async function createPartnership(tenantConfig, partnershipData) {
  const partnershipRepo = getPartnershipRepository(tenantConfig);
  return await partnershipRepo.insert(partnershipData);
}

export async function assignBusOfficer(tenantConfig, officerId, orgIds, companyName, notes) {
  const partnershipRepo = getPartnershipRepository(tenantConfig);
  const userRepo = getUserRepository(tenantConfig);

  for (const orgId of orgIds) {
    await partnershipRepo.insert({
      partnershipId: `partnership_${officerId}_${orgId}`,
      tenantId: tenantConfig.tenantId,
      orgId,
      externalUserId: officerId,
      externalCompanyName: companyName,
      notes,
      active: true,
    });
  }

  const user = await userRepo.getById(officerId);
  user.allowedOrgIds = [...new Set([...(user.allowedOrgIds || []), ...orgIds])];
  await userRepo.update(officerId, user);
}

export async function listPartnerships(tenantConfig) {
  const partnershipRepo = getPartnershipRepository(tenantConfig);
  return await partnershipRepo.list();
}