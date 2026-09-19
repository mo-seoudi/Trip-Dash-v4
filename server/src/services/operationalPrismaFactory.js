import { PrismaClient as OperationalPrismaClient } from "../prisma-operational/index.js";
import { resolveOperationalDataSource } from "./operationalDataSourceResolver.js";

const clientCache = new Map();
const DEFAULT_IDLE_MS = Number(process.env.OPERATIONAL_CLIENT_IDLE_MS || 15 * 60 * 1000);

function assertPostgresUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Operational datasource credential is not a valid database URL");
  }
  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
    throw new Error("Operational datasource credential must use PostgreSQL");
  }
}

function createClient(connectionUrl) {
  assertPostgresUrl(connectionUrl);
  return new OperationalPrismaClient({
    datasources: { db: { url: connectionUrl } },
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

function touch(entry) {
  entry.lastUsedAt = Date.now();
  return entry.client;
}

/**
 * Resolve infrastructure for an already-authorized organization. The control
 * plane chooses the physical PostgreSQL datasource; operational rows carry
 * organization ownership themselves and are not partitioned by platform tenant.
 */
export async function getOperationalContextForOrganization(organizationId) {
  const resolved = await resolveOperationalDataSource(organizationId);
  const existing = clientCache.get(resolved.id);
  const prisma = existing ? touch(existing) : createClient(resolved.connectionUrl);

  if (!existing) {
    clientCache.set(resolved.id, {
      client: prisma,
      lastUsedAt: Date.now(),
      providerLabel: resolved.providerLabel || null,
    });
  }

  return {
    prisma,
    dataSource: {
      id: resolved.id,
      organizationId: resolved.organizationId,
      name: resolved.name,
      mode: resolved.mode,
      engine: resolved.engine,
      providerLabel: resolved.providerLabel || null,
      region: resolved.region || null,
      schemaVersion: resolved.schemaVersion || null,
      lastVerifiedAt: resolved.lastVerifiedAt || null,
    },
  };
}

export async function getOperationalPrismaForOrganization(organizationId) {
  const { prisma } = await getOperationalContextForOrganization(organizationId);
  return prisma;
}

export async function evictOperationalClient(dataSourceId) {
  const entry = clientCache.get(dataSourceId);
  if (!entry) return false;
  clientCache.delete(dataSourceId);
  await entry.client.$disconnect();
  return true;
}

export async function sweepIdleOperationalClients({ idleMs = DEFAULT_IDLE_MS } = {}) {
  const cutoff = Date.now() - idleMs;
  const stale = [...clientCache.entries()].filter(([, entry]) => entry.lastUsedAt < cutoff);
  await Promise.all(stale.map(([id]) => evictOperationalClient(id)));
  return stale.length;
}

export async function disconnectAllOperationalClients() {
  const entries = [...clientCache.values()];
  clientCache.clear();
  await Promise.allSettled(entries.map(({ client }) => client.$disconnect()));
}

export function getOperationalClientCacheStats() {
  return { size: clientCache.size };
}
