import { createOperationalService } from "../../runtime/operationalService.js";
import { createBusAssignmentService } from "./busAssignmentService.js";

function service(req) {
  return createOperationalService(req.operational, createBusAssignmentService);
}

export async function listBusAssignments(req, res, next) {
  try {
    const assignments = await service(req).list(req.params.tripId);
    return res.json({ data: assignments });
  } catch (error) {
    return next(error);
  }
}

export async function createBusAssignment(req, res, next) {
  try {
    const assignment = await service(req).create(req.params.tripId, req.body || {});
    return res.status(201).json({ data: assignment });
  } catch (error) {
    return next(error);
  }
}
