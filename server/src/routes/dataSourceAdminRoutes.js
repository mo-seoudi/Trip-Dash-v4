// Transitional operational data-source registry API.
// Backed by legacy data_connections until canonical OperationalDataSource is
// migrated. The outward contract already uses the rebuilt terminology and
// never exposes secretRef/vaultSecretId to browser reads.

import { Router } from "express";
import { prismaGlobal } from "../lib/prismaGlobal.js";
import { requireAuth } from "../middleware/auth.js";
import { assertCanonicalTenantAccess, requireCanonicalPermission } from "../middleware/canonicalAccess.js";
import { PERMISSIONS } from "../services/accessCatalog.js";
import { normalizeDataSourceProvider, publicDataSourceView } from "../services/operationalDataSource.js";
import { prismaForOperationalDataSource } from "../services/operationalPrismaPool.js";
import { parseSecretRef } from "../services/secretProvider.js";

const router = Router();
router.use(requireAuth, requireCanonicalPermission(PERMISSIONS.ACCESS_ADMIN));

function clean(value, max = 200, field = "value") {
  const result = String(value ?? "").trim();
  if (!result) return null;
  if (result.length > max) {
    const error = new Error(`${field} must be ${max} characters or fewer`);
    error.status = 400;
    throw error;
  }
  return result;
}

function providerFromHost(host) {
  const value = String(host || "").toLowerCase();
  if (value.includes("neon.tech")) return "neon";
  if (value.includes("supabase")) return "supabase";
  return "postgresql";
}

function defaultHostHint(provider) {
  if (provider === "neon") return "neon.tech";
  if (provider === "supabase") return "supabase";
  return "postgresql";
}

function dataSourceForRuntime(row) {
  return {
    id: `legacy:${row.id}`,
    tenantId: row.tenantId,
    organizationId: row.orgId,
    mode: String(row.mode).toUpperCase() === "BYODB" ? "CUSTOMER_POSTGRES" : "HOSTED",
    provider: providerFromHost(row.dbHost),
    region: null,
    secretRef: row.vaultSecretId,
    isActive: Boolean(row.isActive),
    lastVerifiedAt: row.lastVerifiedAt || null,
    updatedAt: row.updatedAt,
  };
}

function view(row) {
  const result = publicDataSourceView(dataSourceForRuntime(row));
  return { ...result, secretConfigured: Boolean(row.vaultSecretId) };
}

// GET /api/data-sources?tenant_id=...
router.get("/", async (req, res, next) => {
  try {
    const tenantId = clean(req.query.tenant_id, 100, "tenant_id");
    if (!tenantId) return res.status(400).json({ message: "tenant_id is required" });
    assertCanonicalTenantAccess(req, tenantId);
    const rows = await prismaGlobal.dataConnection.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
    });
    return res.json(rows.map(view));
  } catch (error) { return next(error); }
});

// PUT /api/data-sources/:schoolId
// Upserts a connection mode. If this row is activated, all other connection
// modes for the same school are deactivated in the same transaction. That
// preserves a deterministic school -> one active operational DB invariant.
router.put("/:schoolId", async (req, res, next) => {
  try {
    const schoolId = clean(req.params.schoolId, 100, "schoolId");
    const school = await prismaGlobal.organization.findUnique({ where: { id: schoolId } });
    if (!school) return res.status(404).json({ message: "School not found" });
    if (String(school.type).toLowerCase() !== "school") {
      return res.status(400).json({ message: "Operational data sources can only be assigned to schools" });
    }
    assertCanonicalTenantAccess(req, school.tenantId);

    const provider = normalizeDataSourceProvider(req.body?.provider || "postgresql");
    const mode = String(req.body?.mode || "HOSTED").toUpperCase();
    if (!["HOSTED", "CUSTOMER_POSTGRES"].includes(mode)) {
      return res.status(400).json({ message: "Unsupported data-source mode" });
    }

    const secretRef = clean(req.body?.secret_ref, 250, "secret_ref");
    if (secretRef) parseSecretRef(secretRef); // syntax only; never resolves secret during registration

    const storedMode = mode === "CUSTOMER_POSTGRES" ? "BYODB" : "SAAS";
    const existing = await prismaGlobal.dataConnection.findUnique({
      where: { orgId_mode: { orgId: school.id, mode: storedMode } },
    });
    if (!existing && !secretRef) {
      return res.status(400).json({ message: "secret_ref is required when creating a data source" });
    }

    // Preserve a private existing host hint only while the provider remains the
    // same. If the admin deliberately changes provider, switch to that provider's
    // neutral hint unless an explicit replacement host_hint was submitted.
    const requestedHostHint = clean(req.body?.host_hint, 250, "host_hint");
    const existingProvider = existing ? providerFromHost(existing.dbHost) : null;
    const hostHint = requestedHostHint ||
      (existing && existingProvider === provider ? existing.dbHost : null) ||
      defaultHostHint(provider);
    const activate = req.body?.is_active === undefined ? true : Boolean(req.body.is_active);

    const row = await prismaGlobal.$transaction(async (tx) => {
      if (activate) {
        await tx.dataConnection.updateMany({
          where: { orgId: school.id, isActive: true, ...(existing ? { id: { not: existing.id } } : {}) },
          data: { isActive: false },
        });
      }

      if (existing) {
        return tx.dataConnection.update({
          where: { id: existing.id },
          data: {
            dbHost: hostHint,
            isActive: activate,
            ...(secretRef ? { vaultSecretId: secretRef } : {}),
          },
        });
      }

      return tx.dataConnection.create({
        data: {
          tenantId: school.tenantId,
          orgId: school.id,
          mode: storedMode,
          dbHost: hostHint,
          vaultSecretId: secretRef,
          isActive: activate,
        },
      });
    });

    return res.status(existing ? 200 : 201).json(view(row));
  } catch (error) {
    if (error?.code === "P2002") return res.status(409).json({ message: "A data source with this mode already exists for the school" });
    return next(error);
  }
});

router.patch("/:id/status", async (req, res, next) => {
  try {
    const id = clean(req.params.id, 100, "data source id");
    const existing = await prismaGlobal.dataConnection.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "Data source not found" });
    assertCanonicalTenantAccess(req, existing.tenantId);
    if (typeof req.body?.is_active !== "boolean") return res.status(400).json({ message: "is_active must be boolean" });

    const row = await prismaGlobal.$transaction(async (tx) => {
      if (req.body.is_active) {
        await tx.dataConnection.updateMany({
          where: { orgId: existing.orgId, isActive: true, id: { not: existing.id } },
          data: { isActive: false },
        });
      }
      return tx.dataConnection.update({ where: { id }, data: { isActive: req.body.is_active } });
    });
    return res.json(view(row));
  } catch (error) { return next(error); }
});

// POST /api/data-sources/:id/verify
// Resolves the configured secret only on the server, opens the same
// provider-neutral Prisma client used by workspace routes, and performs a
// harmless connectivity query. Secret values and raw database errors are never
// returned to the browser.
router.post("/:id/verify", async (req, res, next) => {
  try {
    const id = clean(req.params.id, 100, "data source id");
    const existing = await prismaGlobal.dataConnection.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "Data source not found" });
    assertCanonicalTenantAccess(req, existing.tenantId);

    if (!existing.vaultSecretId) {
      return res.status(409).json({
        message: "This data source has no configured database credential",
        code: "DATA_SOURCE_SECRET_MISSING",
      });
    }

    const runtimeSource = dataSourceForRuntime(existing);
    let prisma;
    try {
      prisma = await prismaForOperationalDataSource(runtimeSource);
      await prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      console.error("Operational data-source verification failed", {
        dataSourceId: existing.id,
        organizationId: existing.orgId,
        provider: runtimeSource.provider,
        errorCode: error?.code || null,
      });
      return res.status(422).json({
        ok: false,
        code: "DATA_SOURCE_VERIFICATION_FAILED",
        message: "The operational database connection could not be verified. Check the configured credential, database availability, and network/SSL settings.",
      });
    }

    const verifiedAt = new Date();
    const updated = await prismaGlobal.dataConnection.update({
      where: { id: existing.id },
      data: { lastVerifiedAt: verifiedAt },
    });

    return res.json({
      ok: true,
      verifiedAt: updated.lastVerifiedAt,
      dataSource: view(updated),
    });
  } catch (error) { return next(error); }
});

export default router;
