import { getAuthorizedOperationalContext, OperationalAuthorizationError } from "../services/authorizedOperationalContext.js";

export function operationalRequestContext(requiredPermission = null) {
  return async function resolveOperationalRequestContext(req, res, next) {
    try {
      const schoolId = req.params?.schoolId || req.headers["x-school-id"];
      const identity = req.user || req.identity;

      req.operational = await getAuthorizedOperationalContext({
        identity,
        schoolId,
        requiredPermission,
      });

      return next();
    } catch (error) {
      if (error instanceof OperationalAuthorizationError) {
        return res.status(error.status).json({
          error: error.code,
          message: error.message,
        });
      }
      return next(error);
    }
  };
}

export function requireOperationalContext(req, _res, next) {
  if (!req.operational?.prisma || !req.operational?.workspace) {
    return next(new OperationalAuthorizationError(
      "Operational request context was not resolved",
      "OPERATIONAL_CONTEXT_REQUIRED",
      500
    ));
  }
  return next();
}
