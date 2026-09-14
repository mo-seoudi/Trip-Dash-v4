// Dynamic operational PostgreSQL client pool.
//
// The control plane chooses an authorized OperationalDataSource record. This
// module resolves its server-side secret reference and creates/reuses a Prisma
// client generated from prisma/operational.schema.prisma. Provider-specific
// application logic is deliberately absent: Supabase, Neon and generic
// PostgreSQL all receive the same Prisma client contract.

import { createHash } from "node:crypto";
import { assertPostgresCompatibleDataSource } from "./operationalDataSource.js";
import { resolveSecretValue } from "./secretProvider.js";

const clients = new Map();
let operationalClientModulePromise;

async function loadOperationalClient() {
  if (!operationalClientModulePromise) {
    operationalClientModulePromise = import("../prisma-operational/index.js");
  }
  return operationalClientModulePromise;
}

function credentialFingerprint(value) {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function cacheKey(dataSource, databaseUrl) {
  // The URL itself is never used as a Map key/loggable identifier. A short hash
  // lets a rotated vault secret produce a fresh Prisma client automatically.
  return `${dataSource.id}:${credentialFingerprint(databaseUrl)}`;
}

export async function prismaForOperationalDataSource(input) {
  const dataSource = assertPostgresCompatibleDataSource(input);
  const databaseUrl = await resolveSecretValue(dataSource.secretRef);
  const key = cacheKey(dataSource, databaseUrl);
  const existing = clients.get(key);
  if (existing) return existing;

  // Remove stale cached versions of the same data-source record. A secret
  // rotation is therefore picked up after the secret-provider cache expires.
  for (const [cachedKey, client] of clients.entries()) {
    if (cachedKey.startsWith(`${dataSource.id}:`) && cachedKey !== key) {
      clients.delete(cachedKey);
      Promise.resolve(client.$disconnect()).catch(() => {});
    }
  }

  const { PrismaClient } = await loadOperationalClient();
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
