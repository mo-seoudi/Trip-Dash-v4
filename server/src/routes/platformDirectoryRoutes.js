import { Router } from "express";
import { prismaControl } from "../lib/prismaControl.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth, requireAdmin);

async function appUser(req) {
  const legacyUserId = Number(req.user?.id);
  return prismaControl.appUser.findFirst({
    where: {
      OR: [
        ...(Number.isInteger(legacyUserId) ? [{ legacyUserId }] : []),
        ...(req.user?.email ? [{ email: req.user.email }] : []),
      ],
    },
  });
}

async function platformAdmin(req) {
  const user = await appUser(req);
  if (!user) return null;
  const assignment = await prismaControl.roleAssignment.findFirst({
    where: {
      userId: user.id,
      isActive: true,
      scopeType: "PLATFORM",
      role: { key: "super_admin" },
    },
    select: { id: true },
  });
  return assignment ? user : null;
}

const orgView = (o) => ({
  id: o.id,
  type: o.type,
  display_name: o.displayName,
  full_name: o.fullName,
  abbreviation: o.abbreviation,
  slug: o.slug,
  status: o.status,
});

router.get("/", async (req, res, next) => {
  try {
    if (!(await platformAdmin(req))) {
      return res.status(403).json({ message: "Platform Super Admin access required" });
    }

    const [organizations, users, sources, coverage] = await Promise.all([
      prismaControl.organization.findMany({
        orderBy: [{ type: "asc" }, { displayName: "asc" }],
        include: {
          memberships: { where: { status: "ACTIVE" }, select: { id: true } },
          roleAssignments: {
            where: { isActive: true },
            include: {
              role: true,
              user: { select: { id: true, email: true, displayName: true } },
            },
          },
          tenantCoverage: {
            include: { tenant: { select: { id: true, name: true } } },
          },
        },
      }),
      prismaControl.appUser.findMany({
        orderBy: [{ displayName: "asc" }, { email: "asc" }],
        include: {
          memberships: {
            include: {
              organization: { select: { id: true, displayName: true, type: true } },
            },
            orderBy: { createdAt: "asc" },
          },
          roleAssignments: {
            where: { isActive: true },
            include: {
              role: true,
              organization: { select: { id: true, displayName: true } },
              tenant: { select: { id: true, name: true } },
            },
          },
        },
      }),
      prismaControl.operationalDataSource.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          organization: { select: { id: true, displayName: true, type: true } },
        },
      }),
      prismaControl.tenantOrganization.findMany({
        include: {
          tenant: { select: { id: true, name: true } },
          organization: { select: { id: true, displayName: true } },
        },
      }),
    ]);

    return res.json({
      organizations: organizations.map((o) => ({
        ...orgView(o),
        active_memberships: o.memberships.length,
        roles: o.roleAssignments.map((a) => ({
          id: a.id,
          role: a.role?.key,
          role_name: a.role?.name,
          user: a.user,
        })),
        tenants: o.tenantCoverage.map((x) => x.tenant),
      })),
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        display_name: u.displayName,
        status: u.status,
        memberships: u.memberships.map((m) => ({
          id: m.id,
          status: m.status,
          is_primary: m.isPrimary,
          job_title: m.jobTitle,
          organization: {
            id: m.organization.id,
            display_name: m.organization.displayName,
            type: m.organization.type,
          },
        })),
        roles: u.roleAssignments.map((a) => ({
          id: a.id,
          scope_type: a.scopeType,
          role: a.role?.key,
          role_name: a.role?.name,
          organization: a.organization
            ? { id: a.organization.id, display_name: a.organization.displayName }
            : null,
          tenant: a.tenant || null,
        })),
      })),
      data_sources: sources.map((s) => ({
        id: s.id,
        name: s.name,
        mode: s.mode,
        engine: s.engine,
        provider_label: s.providerLabel,
        is_active: s.isActive,
        last_verified_at: s.lastVerifiedAt,
        organization: {
          id: s.organization.id,
          display_name: s.organization.displayName,
          type: s.organization.type,
        },
      })),
      coverage: coverage.map((c) => ({
        tenant: c.tenant,
        organization: {
          id: c.organization.id,
          display_name: c.organization.displayName,
        },
        coverage_type: c.coverageType,
      })),
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
