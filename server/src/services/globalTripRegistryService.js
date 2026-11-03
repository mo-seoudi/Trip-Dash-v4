// Global trip registry reconciliation. Intentionally not wired into request paths
// until the reviewed control and operational migrations have been deployed.
// Re-running this operation is safe: the operational UUID is stable, and the
// registry upsert is keyed by the global UUID.
import { randomUUID } from "node:crypto";
import { prismaControl } from "../lib/prismaControl.js";
import { getOperationalContextForOrganization } from "./operationalPrismaFactory.js";

export class GlobalTripRegistrationError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "GlobalTripRegistrationError";
    this.code = code;
  }
}

function assertUuid(value, field) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""))) {
    throw new GlobalTripRegistrationError(`Invalid ${field}`, "INVALID_GLOBAL_IDENTITY");
  }
  return String(value).toLowerCase();
}

/**
 * Intended for post-migration backfill and durable retry workers.
 * This service must NOT be called from an HTTP request before both schema
 * migrations are applied. The caller must authenticate/authorize separately.
 */
export async function reconcileGlobalTrip({
  schoolId, localTripId, control = prismaControl,
  getContext = getOperationalContextForOrganization,
  newId = randomUUID,
}) {
  assertUuid(schoolId, "schoolId");
  if (!Number.isSafeInteger(localTripId) || localTripId <= 0) {
    throw new GlobalTripRegistrationError("Invalid local trip id", "INVALID_LOCAL_TRIP_ID");
  }

  const [coverage, context] = await Promise.all([
    control.tenantOrganization.findMany({
      where: { organizationId: schoolId },
      select: { tenantId: true },
      take: 2,
    }),
    getContext(schoolId),
  ]);
  if (coverage.length !== 1) {
    throw new GlobalTripRegistrationError("School must have exactly one tenant mapping", "TENANT_MAPPING_AMBIGUOUS");
  }
  const { prisma, dataSource } = context;
  assertUuid(dataSource.id, "dataSourceId");
  const trip = await prisma.trip.findFirst({
    where: { id: localTripId, owningSchoolOrganizationId: schoolId },
    select: { id: true, globalTripId: true, createdByAppUserId: true, createdAt: true },
  });
  if (!trip) throw new GlobalTripRegistrationError("Trip not found in school workspace", "TRIP_NOT_FOUND");

  // Atomic compare-and-set ensures concurrent workers cannot assign two UUIDs.
  let globalId = trip.globalTripId;
  if (!globalId) {
    const candidate = newId();
    assertUuid(candidate, "generatedGlobalTripId");
    await prisma.trip.updateMany({
      where: { id: localTripId, owningSchoolOrganizationId: schoolId, globalTripId: null },
      data: { globalTripId: candidate },
    });
    const refreshed = await prisma.trip.findFirst({
      where: { id: localTripId, owningSchoolOrganizationId: schoolId },
      select: { globalTripId: true },
    });
    globalId = refreshed?.globalTripId;
  }
  if (!globalId) throw new GlobalTripRegistrationError("Trip global UUID assignment failed", "GLOBAL_ID_ASSIGNMENT_FAILED");
  assertUuid(globalId, "globalTripId");

  // Legacy trips may lack a creator. Do not fabricate an identity.
  const creatorId = trip.createdByAppUserId ? assertUuid(trip.createdByAppUserId, "createdByAppUserId") : null;
  const tenantId = coverage[0].tenantId;
  assertUuid(tenantId, "tenantId");

  // Guard against the same source/local ID already being registered to a
  // different global UUID. Never silently reassign another trip's identity.
  const existing = await control.globalTripRegistry.findFirst({
    where: { dataSourceId: dataSource.id, operationalTripId: localTripId },
    select: { id: true },
  });
  if (existing && existing.id !== globalId) {
    throw new GlobalTripRegistrationError("Registry identity conflict", "REGISTRY_IDENTITY_CONFLICT");
  }

  const byId = await control.globalTripRegistry.findUnique({ where: { id: globalId } });
  if (byId && (byId.tenantId !== tenantId || byId.schoolOrgId !== schoolId ||
      byId.dataSourceId !== dataSource.id || byId.operationalTripId !== localTripId)) {
    throw new GlobalTripRegistrationError("Registry ownership conflict", "REGISTRY_OWNERSHIP_CONFLICT");
  }

  if (byId && (byId.createdByUserId !== creatorId || byId.createdAt.getTime() !== trip.createdAt.getTime())) {
    throw new GlobalTripRegistrationError("Registry provenance conflict", "REGISTRY_PROVENANCE_CONFLICT");
  }

  const row = await control.globalTripRegistry.upsert({
    where: { id: globalId },
    create: {
      id: globalId, tenantId, schoolOrgId: schoolId, createdByUserId: creatorId,
      createdAt: trip.createdAt, dataSourceId: dataSource.id, operationalTripId: localTripId, registrationStatus: "active",
    },
    update: {
      // Immutable ownership fields are deliberately omitted from updates.
      registrationStatus: "active",
    },
  });
  if (row.tenantId !== tenantId || row.schoolOrgId !== schoolId ||
      row.dataSourceId !== dataSource.id || row.operationalTripId !== localTripId) {
    throw new GlobalTripRegistrationError("Registry ownership conflict", "REGISTRY_OWNERSHIP_CONFLICT");
  }
  return { globalTripId: globalId, operationalTripId: localTripId, dataSourceId: dataSource.id, status: row.registrationStatus };
}
