import { getTenantConfig } from "./tenantService.js";

export async function verifyToken(token, tenantId) {
  const tenantConfig = await getTenantConfig(tenantId);
  const authProvider = await loadAuthProvider(tenantConfig.authProvider);
  return await authProvider.verifyToken(token);
}

export async function loginUser(email, password, tenantId) {
  const tenantConfig = await getTenantConfig(tenantId);
  const authProvider = await loadAuthProvider(tenantConfig.authProvider);
  return await authProvider.login(email, password, tenantConfig, tenantId);
}

async function loadAuthProvider(providerType) {
  switch (providerType) {
    case "firebase":
      return await import("../providers/auth/firebaseAuthProvider.js");
    case "auth0":
      return await import("../providers/auth/auth0Provider.js");
    case "msGraph":
      return await import("../providers/auth/msGraphAuthProvider.js");
    default:
      throw new Error("Unknown auth provider");
  }
}
