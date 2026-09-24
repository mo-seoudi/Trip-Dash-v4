import { prismaControl } from "../lib/prismaControl.js";
import { resolveSecret } from "./secretProviderResolver.js";

export class OperationalDataSourceError extends Error {
  constructor(message, code = "OPERATIONAL_DATASOURCE_ERROR", status = 503) {
    super(message);
    this.name = "OperationalDataSourceError";
    this.code = code;
    this.status = status;
  }
}

function hostedConnectionUrl() {
  const url = String(process.env.OPERATIONAL_DATABASE_URL || "").trim();
  if (!url) {
    throw new OperationalDataSourceError(
      "Platform operational database is not configured",
      "PLATFORM_DATASOURCE_NOT_CONFIGURED"
    );
  }
  return url;
}

/**
 * Resolve an organization's active operational PostgreSQL datasource.
 * HOSTED uses the platform operational database; CUSTOMER_POSTGRES resolves
 * the organization's own server-side credential.
 */
export async function resolveOperationalDataSource(organizationId) {
  if (!organizationId) {
    throw new OperationalDataSourceError("Organization id is required", "ORGANIZATION_REQUIRED", 400);
  }

  const sources = await prismaControl.operationalDataSource.findMany({
    where: { organizationId, isActive: true },
    include: { credential: { include: { secretProvider: true } } },
    orderBy: { createdAt: "asc" },
    take: 2,
  });

  if (sources.length === 0) {
    throw new OperationalDataSourceError(
      "No operational data source is configured for this school workspace",
      "DATASOURCE_NOT_CONFIGURED"
    );
  }
  if (sources.length > 1) {
    throw new OperationalDataSourceError(
      "Multiple active operational data sources are assigned to this school workspace",
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

  let connectionUrl;
  if (dataSource.mode === "HOSTED") {
    connectionUrl = hostedConnectionUrl();
  } else {
    if (!dataSource.credential?.isActive || !dataSource.credential?.secretProvider?.isActive) {
      throw new OperationalDataSourceError(
        "Operational datasource has no active credential configuration",
        "DATASOURCE_CREDENTIAL_NOT_CONFIGURED"
      );
    }
    connectionUrl = await resolveSecret({
      provider: dataSource.credential.secretProvider,
      credential: dataSource.credential,
    });
  }

  return {
    id: dataSource.id,
    organizationId: dataSource.organizationId,
    name: dataSource.name,
    mode: dataSource.mode,
    engine: dataSource.engine,
    providerLabel: dataSource.providerLabel,
    region: dataSource.region,
    schemaVersion: dataSource.schemaVersion,
    lastVerifiedAt: dataSource.lastVerifiedAt,
    connectionUrl,
  };
}
