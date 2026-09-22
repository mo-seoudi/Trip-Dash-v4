export class OperationalServiceContextError extends Error {
  constructor(message = "Operational service requires a scoped database client") {
    super(message);
    this.name = "OperationalServiceContextError";
    this.code = "SCOPED_OPERATIONAL_CLIENT_REQUIRED";
  }
}

// Operational services receive an already-authorized school-scoped client.
// The selected school determines the physical datasource through the control
// plane. Platform tenancy/subscription access is deliberately not part of
// operational routing or service execution.
export function createOperationalService(context, implementation) {
  if (!context?.prisma || !context?.workspace?.schoolId) {
    throw new OperationalServiceContextError(
      "Operational service requires routed school context"
    );
  }
  if (typeof implementation !== "function") {
    throw new TypeError("Operational service implementation must be a function");
  }
  return implementation({
    prisma: context.prisma,
    workspace: context.workspace,
    user: context.user,
  });
}
