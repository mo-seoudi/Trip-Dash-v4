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

export function registerSecretProviderAdapter(type, adapter) {
  if (!type || typeof adapter?.resolve !== "function") {
    throw new TypeError("Secret provider adapter must expose resolve(context)");
  }
  adapters.set(String(type).toUpperCase(), adapter);
}

export function unregisterSecretProviderAdapter(type) {
  adapters.delete(String(type).toUpperCase());
}

export async function resolveSecret({ provider, credential }) {
  if (!provider?.isActive) {
    throw new SecretResolutionError("Secret provider is inactive", "SECRET_PROVIDER_INACTIVE");
  }
  if (!credential?.isActive) {
    throw new SecretResolutionError("Datasource credential is inactive", "DATASOURCE_CREDENTIAL_INACTIVE");
  }

  const adapter = adapters.get(String(provider.type).toUpperCase());
  if (!adapter) {
    throw new SecretResolutionError(
      `No secret adapter registered for provider type ${provider.type}`,
      "SECRET_PROVIDER_UNSUPPORTED"
    );
  }

  const value = await adapter.resolve({ provider, credential });
  if (typeof value !== "string" || value.trim() === "") {
    throw new SecretResolutionError("Secret provider returned an empty credential");
  }
  return value;
}

// Environment-backed secrets are useful when the backend host (for example
// Render) owns secret storage. The control plane stores only the environment
// variable name in DataSourceCredential.secretReference.
registerSecretProviderAdapter("ENVIRONMENT", {
  async resolve({ credential }) {
    const variableName = credential.secretReference;
    if (!variableName || !/^[A-Z_][A-Z0-9_]*$/i.test(variableName)) {
      throw new SecretResolutionError("Invalid environment secret reference", "INVALID_SECRET_REFERENCE");
    }
    const value = process.env[variableName];
    if (!value) {
      throw new SecretResolutionError("Configured environment secret is unavailable", "SECRET_NOT_FOUND");
    }
    return value;
  },
});
