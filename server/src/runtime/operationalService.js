export class OperationalServiceContextError extends Error {
  constructor(message = "Operational service requires a scoped database client") { super(message); this.name = "OperationalServiceContextError"; this.code = "SCOPED_OPERATIONAL_CLIENT_REQUIRED"; }
}

// Operational services receive an already-authorized school-scoped client and
// the tenant partition attached to the routed datasource. Platform
// tenancy/subscription access remains outside this service context.
export function createOperationalService(context, implementation) {
  if (!context?.prisma || !context?.workspace?.schoolId || !context?.tenantId) {
    throw new OperationalServiceContextError("Operational service requires routed tenant and school context");
  }
  if (typeof implementation !== "function") throw new TypeError("Operational service implementation must be a function");
  return implementation({
    prisma: context.prisma,
    workspace: context.workspace,
    user: context.user,
    tenantId: context.tenantId,
  });
}
