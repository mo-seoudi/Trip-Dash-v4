// Central resolver from authorized school context -> operational PostgreSQL.
//
// This service intentionally knows nothing about Supabase or Neon beyond the
// provider metadata on OperationalDataSource. The caller must first establish
// the user's effective access to the requested school; this resolver then finds
// the active data source registered for that school and returns its Prisma
// client.

import { prisma } from "../lib/prisma.js";
import { prismaForOperationalDataSource } from "./operationalPrismaPool.js";
import { publicDataSourceView } from "./operationalDataSource.js";

function requiredId(value, field) {
  const id = String(value || "").trim();
  if (!id) {
    const error = new Error(`${field} is required`);
    error.status = 400;
    throw error;
  }
  return id;
}

export async function resolveSchoolOperationalDataSource({ tenantId, schoolOrganizationId }) {
  const tenant = requiredId(tenantId, "tenantId");
  const school = requiredId(schoolOrganizationId, "schoolOrganizationId");

  const organization = await prisma.organization.findFirst({
    where: { id: school, tenantId: tenant, type: "SCHOOL", status: "active" },
    select: { id: true, tenantId: true, type: true, status: true },
  });
  if (!organization) {
    const error = new Error("Active school organization not found in this tenant");
    error.status = 404;
    throw error;
  }

  const schoolSource = await prisma.operationalDataSource.findFirst({
    where: { tenantId: tenant, organizationId: school, isActive: true },
    orderBy: { updatedAt: "desc" },
  });

  // A tenant-level source is the default shared operational database. A school
  // source overrides it. This lets today's Supabase database remain the shared
  // default while one test school can later point to Neon.
  const tenantSource = schoolSource
    ? null
    : await prisma.operationalDataSource.findFirst({
        where: { tenantId: tenant, organizationId: null, isActive: true },
        orderBy: { updatedAt: "desc" },
      });

  const dataSource = schoolSource || tenantSource;
  if (!dataSource) {
    const error = new Error("No active operational database is configured for this school");
    error.status = 409;
    throw error;
  }

  return dataSource;
}

export async function operationalContextForSchool(input) {
  const dataSource = await resolveSchoolOperationalDataSource(input);
  const operationalPrisma = await prismaForOperationalDataSource(dataSource);
  return {
    prisma: operationalPrisma,
    dataSource: publicDataSourceView(dataSource),
  };
}
