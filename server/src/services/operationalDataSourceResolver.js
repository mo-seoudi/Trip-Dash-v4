import { prismaControl } from "../lib/prismaControl.js";
import { resolveSecret } from "./secretProviderResolver.js";

export class OperationalDataSourceError extends Error {
  constructor(message, code = "OPERATIONAL_DATASOURCE_ERROR") {
    super(message);
    this.name = "OperationalDataSourceError";
    this.code = code;
  }
}

/**
 * Resolve an organization's active operational PostgreSQL datasource.
 *
 * Authorization must happen before calling this function. This service only
 * maps an already-authorized organization/workspace to infrastructure.
 */
export async function resolveOperationalDataSource(organizationId) {
  if (!organizationId) {
    throw new OperationalDataSourceError("Organization id is required", "ORGANIZATION_REQUIRED");
  }

  const sources = await prismaControl.operationalDataSource.findMany({
    where: { organizationId, isActive: true },
    include: {
      credential: {
        include: { secretProvider: true },
      },
    },
    orderBy: { createdAt: "asc" },
    take: 2,
  });

  if (sources.length === 0) {
    throw new OperationalDataSourceError(
      "No active operational datasource is assigned to this organization",
      "DATASOURCE_NOT_CONFIGURED"
    );
  }
  if (sources.length > 1) {
    throw new OperationalDataSourceError(
      "Multiple active operational datasources are assigned to this organization",
      "DATASOURCE_AMBIGUOUS"
    );
  }

  const dataSource = sources[0];
  if (String(dataSource.engine).toLowerCase() !== "postgresql") {
    throw new OperationalDataSourceError(
      "Operational datasource engine is not supported",
      "DATASOURCE_ENGINE_UNSUPPORTED"
    );
  }
  if (!dataSource.credential?.secretProvider) {
    throw new OperationalDataSourceError(
      "Operational datasource has no active credential configuration",
      "DATASOURCE_CREDENTIAL_NOT_CONFIGURED"
    );
  }

  const connectionUrl = await resolveSecret({
    provider: dataSource.credential.secretProvider,
    credential: dataSource.credential,
  });

  return {
    id: dataSource.id,
    tenantId: dataSource.tenantId,
    organizationId: dataSource.organizationId,
    name: dataSource.name,
    engine: dataSource.engine,
    providerLabel: dataSource.providerLabel,
    region: dataSource.region,
    schemaVersion: dataSource.schemaVersion,
    connectionUrl,
  };
}
