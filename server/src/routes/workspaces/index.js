import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import operationalTripsRouter from "./operationalTrips.js";
import operationalBookingsRouter from "./operationalBookings.js";

const router = Router({ mergeParams: true });

// Authenticate at the workspace boundary. Authorization, workspace scope and
// operational datasource selection are resolved by the canonical backend
// access and control-plane services used by the mounted routers.
router.use(requireAuth);
router.use(operationalTripsRouter);
router.use(operationalBookingsRouter);

export default router;
