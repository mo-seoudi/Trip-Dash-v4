import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import operationalTripsRouter from "./operationalTrips.js";

const router = Router({ mergeParams: true });

// Authentication is currently supplied by the transition auth boundary. All
// authorization, workspace scope and datasource selection below this point are
// canonical control-plane concerns.
router.use(requireAuth);
router.use(operationalTripsRouter);

export default router;
