// Transitional operational data-source registry API.
// Backed by legacy data_connections until canonical OperationalDataSource is
// migrated. The outward contract already uses the rebuilt terminology and
// never exposes secretRef/vaultSecretId to browser reads.

import { Router } from "express";
import { prismaGlobal } from "../lib/prismaGlobal.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { normalizeDataSourceProvider, publicDataSourceView } from "../services/operationalDataSource.js";
import { parseSecretRef } from "../services/secretProvider.js";

const router = Router();
router.use(requireAuth, requireAdmin);

function clean(value, max = 200) {
  const result = String(value ?? "").trim();
  return result ? result.slice(0, max) : null;
}

async function requestGlobalUser(req) {
  return (
    (await prismaGlobal.user.findFirst({ where: { legacyUserId: Number(req.user.id) } })) ||
    (await prismaGlobal.user.findFirst({ where: { email: req.user.email } }))
  );
}

async function assertTenant(req, tenantId) {
  const user = await requestGlobalUser(req);
  if (user?.tenantId && user.tenantId !== tenantId) {
    const error = new Error("Forbidden for this tenant");
    error.status = 403;
    throw error;
  }
}

function providerFromHost(host) {
  const value = String(host || "").toLowerCase();
  if (value.includes("neon.tech")) return "neon";
  if (value.includes("supabase")) return "supabase";
  return "postgresql";
}

function view(row) {
  const result = publicDataSourceView({
    id: row.id,
    tenantId: row.tenantId,
    organizationId: row.orgId,
    mode: String(row.mode).toUpperCase() === "BYODB" ? "CUSTOMER_POSTGRES" : "HOSTED",
    provider: providerFromHost(row.dbHost),
    region: null,
    isActive: row.isActive,
    lastVerifiedAt: row.lastVerifiedAt,
  });
  return { ...result, secretConfigured: Boolean(row.vaultSecretId) };
}

// GET /api/data-sources?tenant_id=...
router.get("/", async (req, res, next) => {
  try {
    const tenantId = clean(req.query.tenant_id, 100);
    if (!tenantId) return res.status(400).json({ message: "tenant_id is required" });
    await assertTenant(req, tenantId);
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
    const schoolId = clean(req.params.schoolId, 100);
    const school = await prismaGlobal.organization.findUnique({ where: { id: schoolId } });
    if (!school) return res.status(404).json({ message: "School not found" });
    if (String(school.type).toLowerCase() !== "school") {
      return res.status(400).json({ message: "Operational data sources can only be assigned to schools" });
    }
    await assertTenant(req, school.tenantId);

    const provider = normalizeDataSourceProvider(req.body?.provider || "postgresql");
    const mode = String(req.body?.mode || "HOSTED").toUpperCase();
    if (!["HOSTED", "CUSTOMER_POSTGRES"].includes(mode)) {
      return res.status(400).json({ message: "Unsupported data-source mode" });
    }

    const secretRef = clean(req.body?.secret_ref, 500);
    if (secretRef) parseSecretRef(secretRef); // syntax only; never resolves secret during registration

    const hostHint = clean(req.body?.host_hint, 250) ||
      (provider === "neon" ? "neon.tech" : provider === "supabase" ? "supabase" : "postgresql");
    const storedMode = mode === "CUSTOMER_POSTGRES" ? "BYODB" : "SAAS";
    const activate = req.body?.is_active === undefined ? true : Boolean(req.body.is_active);

    const existing = await prismaGlobal.dataConnection.findUnique({
      where: { orgId_mode: { orgId: school.id, mode: storedMode } },
    });
    if (!existing && !secretRef) {
      return res.status(400).json({ message: "secret_ref is required when creating a data source" });
    }

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
    const id = clean(req.params.id, 100);
    const existing = await prismaGlobal.dataConnection.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "Data source not found" });
    await assertTenant(req, existing.tenantId);
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

export default router;
