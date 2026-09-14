// Server-side secret provider abstraction.
//
// OperationalDataSource rows store opaque references, never credentials.
// Supported references:
//   env:NAME
//   infisical://<environment>/<folder...>/<secret-name>
//
// Example:
//   infisical://prod/customers/repton-dubai/DATABASE_URL
//
// The Infisical machine identity is a bootstrap credential supplied to the
// backend runtime. It should have read-only access to the TripDash secrets
// project and the narrowest practical environment/path scope.

const DEFAULT_INFISICAL_SITE_URL = "https://app.infisical.com";
const DEFAULT_SECRET_CACHE_TTL_MS = 60_000;

let infisicalClientPromise;
const cache = new Map();

function configurationError(message) {
  const error = new Error(message);
  error.status = 500;
  return error;
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function cacheTtlMs() {
  return positiveInteger(process.env.SECRET_CACHE_TTL_MS, DEFAULT_SECRET_CACHE_TTL_MS);
}

export function parseSecretRef(secretRef) {
  const ref = String(secretRef || "").trim();
  if (!ref) throw configurationError("Secret reference is empty");

  if (ref.startsWith("env:")) {
    const name = ref.slice(4).trim();
    if (!/^[A-Z][A-Z0-9_]{2,120}$/.test(name)) {
      throw configurationError("Invalid environment secret reference");
    }
    return { provider: "env", name };
  }

  if (ref.startsWith("infisical://")) {
    let url;
    try {
      url = new URL(ref);
    } catch {
      throw configurationError("Invalid Infisical secret reference");
    }

    const environment = decodeURIComponent(url.hostname || "").trim();
    const segments = url.pathname
      .split("/")
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment));

    const secretName = segments.pop()?.trim();
    const secretPath = `/${segments.join("/")}` || "/";

    if (!environment || !/^[A-Za-z0-9_-]{1,80}$/.test(environment)) {
      throw configurationError("Infisical secret reference has an invalid environment");
    }
    if (!secretName || !/^[A-Za-z0-9_.-]{1,180}$/.test(secretName)) {
      throw configurationError("Infisical secret reference has an invalid secret name");
    }
    if (secretPath.length > 500 || secretPath.includes("..")) {
      throw configurationError("Infisical secret reference has an invalid path");
    }

    return { provider: "infisical", environment, secretPath, secretName };
  }

  throw configurationError("Unsupported secret reference scheme");
}

function resolveEnvironmentSecret(name) {
  const value = process.env[name];
  if (!value) throw configurationError(`Server secret ${name} is not configured`);
  return value;
}

async function getInfisicalClient() {
  if (!infisicalClientPromise) {
    infisicalClientPromise = (async () => {
      const clientId = String(process.env.INFISICAL_CLIENT_ID || "").trim();
      const clientSecret = String(process.env.INFISICAL_CLIENT_SECRET || "").trim();
      if (!clientId || !clientSecret) {
        throw configurationError("Infisical machine identity is not configured on the server");
      }

      const { InfisicalSDK } = await import("@infisical/sdk");
      const client = new InfisicalSDK({
        siteUrl: String(process.env.INFISICAL_SITE_URL || DEFAULT_INFISICAL_SITE_URL).trim(),
      });

      await client.auth().universalAuth.login({ clientId, clientSecret });
      return client;
    })().catch((error) => {
      infisicalClientPromise = null;
      throw error;
    });
  }

  return infisicalClientPromise;
}

async function resolveInfisicalSecret(parsed) {
  const projectId = String(process.env.INFISICAL_PROJECT_ID || "").trim();
  if (!projectId) throw configurationError("INFISICAL_PROJECT_ID is not configured on the server");

  const cacheKey = `${projectId}:${parsed.environment}:${parsed.secretPath}:${parsed.secretName}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const client = await getInfisicalClient();
  let secret;
  try {
    secret = await client.secrets().getSecret({
      environment: parsed.environment,
      projectId,
      secretName: parsed.secretName,
      secretPath: parsed.secretPath,
      type: "shared",
      viewSecretValue: true,
      expandSecretReferences: true,
      includeImports: false,
    });
  } catch (error) {
    // Authentication tokens are short-lived. Drop the cached client so the next
    // attempt performs Universal Auth again rather than pinning a dead session.
    infisicalClientPromise = null;
    throw error;
  }

  const value = String(secret?.secretValue || "");
  if (!value) throw configurationError("Infisical returned an empty secret value");

  cache.set(cacheKey, { value, expiresAt: Date.now() + cacheTtlMs() });
  return value;
}

export async function resolveSecretValue(secretRef) {
  const parsed = parseSecretRef(secretRef);
  if (parsed.provider === "env") return resolveEnvironmentSecret(parsed.name);
  if (parsed.provider === "infisical") return resolveInfisicalSecret(parsed);
  throw configurationError("Unsupported secret provider");
}

export function clearSecretCache() {
  cache.clear();
}
