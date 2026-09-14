// Dynamic operational PostgreSQL client pool.
//
// The control plane chooses an authorized OperationalDataSource record. This
// module resolves its server-side secret reference and creates/reuses a Prisma
// client generated from prisma/operational.schema.prisma. Provider-specific
// application logic is deliberately absent: Supabase, Neon and generic
// PostgreSQL all receive the same Prisma client contract.

import { assertPostgresCompatibleDataSource } from "./operationalDataSource.js";

const clients = new Map();
let operationalClientModulePromise;

async function loadOperationalClient() {
  if (!operationalClientModulePromise) {
    operationalClientModulePromise = import("../prisma-operational/index.js");
  }
  return operationalClientModulePromise;
}

function resolveEnvironmentSecret(secretRef) {
  const ref = String(secretRef || "").trim();
  if (!ref.startsWith("env:")) {
    const error = new Error("Unsupported database secret reference scheme");
    error.status = 500;
    throw error;
  }

  const envName = ref.slice(4).trim();
  if (!/^[A-Z][A-Z0-9_]{2,120}$/.test(envName)) {
    const error = new Error("Invalid database environment secret reference");
    error.status = 500;
    throw error;
  }

  const value = process.env[envName];
  if (!value) {
    const error = new Error(`Database secret ${envName} is not configured on the server`);
    error.status = 500;
    throw error;
  }
  return value;
}

export function resolveDatabaseUrl(secretRef) {
  // Initial implementation deliberately supports environment-backed secrets
  // only. A managed secret store can replace/extend this without changing the
  // OperationalDataSource records or route code.
  return resolveEnvironmentSecret(secretRef);
}

function cacheKey(dataSource) {
  return `${dataSource.id}:${dataSource.updatedAt?.toISOString?.() || dataSource.updatedAt || "unknown"}`;
}

export async function prismaForOperationalDataSource(input) {
  const dataSource = assertPostgresCompatibleDataSource(input);
  const key = cacheKey(dataSource);
  const existing = clients.get(key);
  if (existing) return existing;

  // Remove stale cached versions of the same data-source record. This allows a
  // secret rotation/update to take effect after the control-plane row changes.
  for (const [cachedKey, client] of clients.entries()) {
    if (cachedKey.startsWith(`${dataSource.id}:`) && cachedKey !== key) {
      clients.delete(cachedKey);
      Promise.resolve(client.$disconnect()).catch(() => {});
    }
  }

  const { PrismaClient } = await loadOperationalClient();
  const databaseUrl = resolveDatabaseUrl(dataSource.secretRef);
  const client = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });
  clients.set(key, client);
  return client;
}

export async function disconnectOperationalClients() {
  const active = [...clients.values()];
  clients.clear();
  await Promise.allSettled(active.map((client) => client.$disconnect()));
}
