export class OperationalServiceContextError extends Error {
  constructor(message = "Operational service requires a scoped database client") { super(message); this.name = "OperationalServiceContextError"; this.code = "SCOPED_OPERATIONAL_CLIENT_REQUIRED"; }
}

// Operational services receive an already-authorized school-scoped client.
// Platform tenancy/subscription state is intentionally not part of this context.
export function createOperationalService(context, implementation) {
  if (!context?.prisma || !context?.workspace?.schoolId) throw new OperationalServiceContextError();
  if (typeof implementation !== "function") throw new TypeError("Operational service implementation must be a function");
  return implementation({ prisma: context.prisma, workspace: context.workspace, user: context.user });
}
