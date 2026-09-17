import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import operationalTripsRouter from "./operationalTrips.js";
import operationalBookingsRouter from "./operationalBookings.js";

const router = Router({ mergeParams: true });

// Authentication is supplied by the transition auth boundary. Authorization,
// workspace scope and datasource selection below this point are canonical
// control-plane concerns.
router.use(requireAuth);
router.use(operationalTripsRouter);
router.use(operationalBookingsRouter);

export default router;
