import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { resolveEffectiveAccess } from "../services/effectiveAccess.js";

const router = Router();

router.use(requireAuth);

// GET /api/access/me
// Stable frontend bootstrap contract. The current resolver bridges legacy global
// data; after v2 migration the endpoint remains while its backing service changes.
router.get("/me", async (req, res, next) => {
  try {
    const access = await resolveEffectiveAccess(req.user);
    return res.json(access);
  } catch (error) {
    return next(error);
  }
});

export default router;
