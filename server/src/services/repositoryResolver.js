
import { FirebaseTripRepository } from "../repositories/firebase/FirebaseTripRepository.js";
import { MongoTripRepository } from "../repositories/mongo/MongoTripRepository.js";
import { SQLTripRepository } from "../repositories/sql/SQLTripRepository.js";

import { FirebaseTenantRepository } from "../repositories/firebase/FirebaseTenantRepository.js";
import { MongoTenantRepository } from "../repositories/mongo/MongoTenantRepository.js";
import { SQLTenantRepository } from "../repositories/sql/SQLTenantRepository.js";

import { FirebaseUserRepository } from "../repositories/firebase/FirebaseUserRepository.js";
import { MongoUserRepository } from "../repositories/mongo/MongoUserRepository.js";
import { SQLUserRepository } from "../repositories/sql/SQLUserRepository.js";

import { FirebaseSettingsRepository } from "../repositories/firebase/FirebaseSettingsRepository.js";
import { MongoSettingsRepository } from "../repositories/mongo/MongoSettingsRepository.js";
import { SQLSettingsRepository } from "../repositories/sql/SQLSettingsRepository.js";

import { SQLOrganizationRepository } from "../repositories/sql/SQLOrganizationRepository.js";
import { SQLPartnershipRepository } from "../repositories/sql/SQLPartnershipRepository.js";
import { MongoOrganizationRepository } from "../repositories/mongo/MongoOrganizationRepository.js";
import { MongoPartnershipRepository } from "../repositories/mongo/MongoPartnershipRepository.js";
import { FirebaseOrganizationRepository } from "../repositories/firebase/FirebaseOrganizationRepository.js";
import { FirebasePartnershipRepository } from "../repositories/firebase/FirebasePartnershipRepository.js";

export function getTripRepository(tenantConfig) {
  const type = tenantConfig.type;
  if (type === "firebase") return new FirebaseTripRepository(tenantConfig.firebase);
  if (type === "mongo") return new MongoTripRepository(tenantConfig.mongo);
  if (type === "sql") return new SQLTripRepository(tenantConfig.sql);
  throw new Error("Unsupported database type");
}

export function getTenantRepository(tenantConfig) {
  const type = tenantConfig.type;
  if (type === "firebase") return new FirebaseTenantRepository(tenantConfig.firebase);
  if (type === "mongo") return new MongoTenantRepository(tenantConfig.mongo);
  if (type === "sql") return new SQLTenantRepository(tenantConfig.sql);
  throw new Error("Unsupported database type");
}

export function getUserRepository(tenantConfig) {
  const type = tenantConfig.type;
  if (type === "firebase") return new FirebaseUserRepository(tenantConfig.firebase);
  if (type === "mongo") return new MongoUserRepository(tenantConfig.mongo);
  if (type === "sql") return new SQLUserRepository(tenantConfig.sql);
  throw new Error("Unsupported database type");
}

export function getSettingsRepository(tenantConfig) {
  const type = tenantConfig.type;
  if (type === "firebase") return new FirebaseSettingsRepository(tenantConfig.firebase);
  if (type === "mongo") return new MongoSettingsRepository(tenantConfig.mongo);
  if (type === "sql") return new SQLSettingsRepository(tenantConfig.sql);
  throw new Error("Unsupported database type");
}

export function getOrganizationRepository(tenantConfig) {
  const type = tenantConfig.type;
  if (type === "firebase") return new FirebaseOrganizationRepository(tenantConfig.firebase);
  if (type === "mongo") return new MongoOrganizationRepository(tenantConfig.mongo);
  if (type === "sql") return new SQLOrganizationRepository(tenantConfig.sql);
  throw new Error("Unsupported database type");
}

export function getPartnershipRepository(tenantConfig) {
  const type = tenantConfig.type;
  if (type === "firebase") return new FirebasePartnershipRepository(tenantConfig.firebase);
  if (type === "mongo") return new MongoPartnershipRepository(tenantConfig.mongo);
  if (type === "sql") return new SQLPartnershipRepository(tenantConfig.sql);
  throw new Error("Unsupported database type");
}
