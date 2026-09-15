import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { resolveRuntimeAccess } from "../services/accessRuntime.js";

const router = Router();

router.use(requireAuth);

// GET /api/access/me
// Stable frontend bootstrap contract. Legacy remains authoritative. When the
// explicit shadow flag is enabled, canonical v2 is evaluated side-by-side but
// its result is never returned as the authorization decision.
router.get("/me", async (req, res, next) => {
  try {
    const access = await resolveRuntimeAccess({ user: req.user });
    return res.json(access);
  } catch (error) {
    return next(error);
  }
});

export default router;
