import { PrismaClient } from "../src/prisma-control/index.js";

const prisma = new PrismaClient();

const requiredTables = [
  "tenants",
  "tenant_organizations",
  "app_users",
  "authentication_identities",
  "auth_sessions",
  "organizations",
  "organization_relationships",
  "organization_memberships",
  "roles",
  "permissions",
  "role_permissions",
  "role_assignments",
  "secret_providers",
  "data_source_credentials",
  "operational_data_sources",
  "audit_events",
];

try {
  const rows = await prisma.$queryRaw`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
  `;
  const present = new Set(rows.map((row) => row.table_name));
  const missing = requiredTables.filter((table) => !present.has(table));

  if (missing.length) {
    console.error(`Control-plane schema is incomplete. Missing: ${missing.join(", ")}`);
    process.exitCode = 1;
  } else {
    console.log(`Control-plane schema verified (${requiredTables.length} canonical tables present).`);
  }
} finally {
  await prisma.$disconnect();
}
