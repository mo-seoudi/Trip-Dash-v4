// Provider-neutral secret resolution for operational datasource credentials.
//
// The control plane stores only provider configuration and secret references.
// Actual database credentials are resolved server-side and must never be
// returned to clients or persisted in application logs.

const adapters = new Map();

export class SecretResolutionError extends Error {
  constructor(message, code = "SECRET_RESOLUTION_FAILED") {
    super(message);
    this.name = "SecretResolutionError";
    this.code = code;
  }
}

export function registerSecretProviderAdapter(key, adapter) {
  if (!key || typeof adapter?.resolve !== "function") {
    throw new TypeError("Secret provider adapter must expose resolve(context)");
  }
  adapters.set(String(key).toLowerCase(), adapter);
}

export function unregisterSecretProviderAdapter(key) {
  adapters.delete(String(key).toLowerCase());
}

function adapterKeyFor(provider) {
  if (provider.type === "HOST_ENVIRONMENT") return "host-environment";
  if (provider.type === "EXTERNAL_VAULT") return String(provider.adapterKey || "").toLowerCase();
  return "";
}

export async function resolveSecret({ provider, credential }) {
  if (!provider?.isActive) {
    throw new SecretResolutionError("Secret provider is inactive", "SECRET_PROVIDER_INACTIVE");
  }
  if (!credential?.isActive) {
    throw new SecretResolutionError("Datasource credential is inactive", "DATASOURCE_CREDENTIAL_INACTIVE");
  }

  const key = adapterKeyFor(provider);
  const adapter = adapters.get(key);
  if (!key || !adapter) {
    throw new SecretResolutionError("No compatible secret adapter is registered", "SECRET_PROVIDER_UNSUPPORTED");
  }

  const value = await adapter.resolve({ provider, credential });
  if (typeof value !== "string" || value.trim() === "") {
    throw new SecretResolutionError("Secret provider returned an empty credential");
  }
  return value;
}

// A backend host may own secret storage. The control plane stores only the
// environment-variable name in DataSourceCredential.secretReference.
registerSecretProviderAdapter("host-environment", {
  async resolve({ credential }) {
    const variableName = credential.secretReference;
    if (!variableName || !/^[A-Z_][A-Z0-9_]*$/i.test(variableName)) {
      throw new SecretResolutionError("Invalid host secret reference", "INVALID_SECRET_REFERENCE");
    }
    const value = process.env[variableName];
    if (!value) {
      throw new SecretResolutionError("Configured host secret is unavailable", "SECRET_NOT_FOUND");
    }
    return value;
  },
});
