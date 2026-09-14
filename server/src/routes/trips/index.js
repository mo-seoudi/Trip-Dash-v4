// server/src/routes/trips/index.js

import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import core from "./trips.core.js";
import subtrips from "./trips.subtrips.js";
import passengers from "./trips.passengers.js";

const router = Router();

// Every trip endpoint is private. Resource-level authorization is applied by
// the individual route/service and will progressively move to the new policy
// layer, but unauthenticated access is never permitted.
router.use(requireAuth);
router.use("/", core);          // /api/trips, /api/trips/:id
router.use("/", subtrips);      // /api/trips/:id/subtrips
router.use("/", passengers);    // /api/trips/:id/passengers

export default router;
