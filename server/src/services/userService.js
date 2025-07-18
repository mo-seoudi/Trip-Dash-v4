import { getUserRepository } from "./repositoryResolver.js";

export async function createUser(tenantConfig, userData) {
  const userRepo = getUserRepository(tenantConfig);
  return await userRepo.insert(userData);
}

export async function listUsers(tenantConfig) {
  const userRepo = getUserRepository(tenantConfig);
  return await userRepo.list();
}

export async function getUserById(tenantConfig, userId) {
  const userRepo = getUserRepository(tenantConfig);
  return await userRepo.getById(userId);
}

export async function updateUser(tenantConfig, userId, updates) {
  const userRepo = getUserRepository(tenantConfig);
  return await userRepo.update(userId, updates);
}
