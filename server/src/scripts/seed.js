// ✅ src/scripts/seed.js

import { getTenantRepository } from "../services/repositoryResolver.js";
import { getOrganizationRepository } from "../services/repositoryResolver.js";
import { getUserRepository } from "../services/repositoryResolver.js";
import { getPartnershipRepository } from "../services/repositoryResolver.js";

// 🌟 Choose default config (example)
const tenantConfig = {
  dbConfig: { type: "sql" }, // adjust to your default
};

// 🎓 Tenant
const tenant = {
  tenantId: "example-group",
  name: "Example School Group",
  type: "school_group",
  dbConfig: { type: "sql", connectionString: "..." },
  brandingConfig: {},
  featureFlags: {
    ms365Integration: true,
    googleIntegration: true,
    advancedReports: true,
  },
  plan: "enterprise",
};

// 🏫 Organizations
const org1 = {
  organizationId: "school_a",
  tenantId: "example-group",
  name: "School A",
  campuses: [],
  description: "School A description",
};

const org2 = {
  organizationId: "school_b",
  tenantId: "example-group",
  name: "School B",
  campuses: [],
  description: "School B description",
};

// 👤 Users
const adminUser = {
  userId: "admin1",
  email: "admin@schoola.com",
  tenantId: "example-group",
  assignedSchools: ["school_a"],
  allowedOrgIds: [],
  role: "schoolAdmin",
  permissions: ["MANAGE_STUDENTS", "VIEW_REPORTS"],
  isExternal: false,
};

const busOfficer = {
  userId: "officer1",
  email: "officer1@buscompany.com",
  tenantId: "example-group",
  assignedSchools: [],
  allowedOrgIds: ["school_a", "school_b"],
  role: "busOfficer",
  permissions: ["VIEW_TRIPS", "ASSIGN_ROUTES"],
  isExternal: true,
};

// 🤝 Partnerships
const partnershipA = {
  partnershipId: "partnership_a",
  tenantId: "example-group",
  orgId: "school_a",
  externalUserId: "officer1",
  externalCompanyName: "Bus Company",
  notes: "Handles School A routes",
  active: true,
};

const partnershipB = {
  partnershipId: "partnership_b",
  tenantId: "example-group",
  orgId: "school_b",
  externalUserId: "officer1",
  externalCompanyName: "Bus Company",
  notes: "Handles School B routes",
  active: true,
};

async function seed() {
  const tenantRepo = getTenantRepository(tenantConfig);
  const orgRepo = getOrganizationRepository(tenantConfig);
  const userRepo = getUserRepository(tenantConfig);
  const partnershipRepo = getPartnershipRepository(tenantConfig);

  try {
    await tenantRepo.insert(tenant);
    await orgRepo.insert(org1);
    await orgRepo.insert(org2);
    await userRepo.insert(adminUser);
    await userRepo.insert(busOfficer);
    await partnershipRepo.insert(partnershipA);
    await partnershipRepo.insert(partnershipB);

    console.log("✅ Seeding completed successfully!");
  } catch (err) {
    console.error("❌ Seeding failed:", err);
  }
}

seed();
