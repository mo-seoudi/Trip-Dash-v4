export class OperationalServiceContextError extends Error {
  constructor(message = "Operational service requires a scoped database client") {
    super(message);
    this.name = "OperationalServiceContextError";
    this.code = "SCOPED_OPERATIONAL_CLIENT_REQUIRED";
  }
}

/**
 * Factory used by the new operational domain services. Services receive the
 * already-authorized, school-scoped Prisma client; they do not import a global
 * Prisma singleton or resolve infrastructure themselves.
 */
export function createOperationalService(context, implementation) {
  if (!context?.prisma || !context?.workspace?.schoolId) {
    throw new OperationalServiceContextError();
  }
  if (typeof implementation !== "function") {
    throw new TypeError("Operational service implementation must be a function");
  }

  return implementation({
    prisma: context.prisma,
    workspace: context.workspace,
    user: context.user,
    tenantId: context.tenantId,
  });
}
