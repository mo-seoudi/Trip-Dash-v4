// Provider-neutral operational PostgreSQL data-source contract.
//
// The control plane stores only metadata and a secret reference. Database
// credentials must remain in the server-side secret store/environment and must
// never be returned to the browser. Supabase and Neon are both PostgreSQL hosts
// under this contract; application business logic must not branch on provider.

export const DATA_SOURCE_MODES = Object.freeze({
  HOSTED: "HOSTED",
  CUSTOMER_POSTGRES: "CUSTOMER_POSTGRES",
});

export const POSTGRES_PROVIDERS = Object.freeze({
  SUPABASE: "supabase",
  NEON: "neon",
  POSTGRESQL: "postgresql",
});

const PROVIDERS = new Set(Object.values(POSTGRES_PROVIDERS));
const MODES = new Set(Object.values(DATA_SOURCE_MODES));

export function normalizeDataSourceProvider(value) {
  const provider = String(value || "postgresql").trim().toLowerCase();
  if (!PROVIDERS.has(provider)) {
    const error = new Error("Unsupported PostgreSQL provider");
    error.status = 400;
    throw error;
  }
  return provider;
}

export function validateOperationalDataSource(input = {}) {
  const mode = String(input.mode || DATA_SOURCE_MODES.HOSTED).trim().toUpperCase();
  if (!MODES.has(mode)) {
    const error = new Error("Unsupported operational data-source mode");
    error.status = 400;
    throw error;
  }

  const provider = normalizeDataSourceProvider(input.provider);
  const secretRef = String(input.secretRef || input.secret_ref || "").trim();
  if (!secretRef) {
    const error = new Error("A server-side database secret reference is required");
    error.status = 400;
    throw error;
  }
  if (secretRef.length > 250) {
    const error = new Error("Database secret reference is too long");
    error.status = 400;
    throw error;
  }

  const region = input.region == null ? null : String(input.region).trim().slice(0, 100) || null;
  return { mode, provider, secretRef, region };
}

export function publicDataSourceView(row) {
  if (!row) return null;
  return {
    id: row.id,
    tenantId: row.tenantId,
    organizationId: row.organizationId,
    mode: row.mode,
    provider: row.provider,
    region: row.region || null,
    isActive: row.isActive,
    lastVerifiedAt: row.lastVerifiedAt || null,
    // secretRef is deliberately omitted.
  };
}

export function assertPostgresCompatibleDataSource(row) {
  if (!row?.isActive) {
    const error = new Error("Operational data source is inactive");
    error.status = 409;
    throw error;
  }
  normalizeDataSourceProvider(row.provider);
  if (!row.secretRef) {
    const error = new Error("Operational data source has no database secret configured");
    error.status = 500;
    throw error;
  }
  return row;
}
