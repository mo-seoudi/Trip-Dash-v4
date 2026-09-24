import { createOperationalService } from "../../runtime/operationalService.js";
import { createBusAssignmentService } from "./busAssignmentService.js";
function service(req){return createOperationalService(req.operational,createBusAssignmentService);}
export async function listBusAssignments(req,res,next){try{return res.json({data:await service(req).list(req.params.tripId)});}catch(error){return next(error);}}
export async function createBusAssignment(req,res,next){try{return res.status(201).json({data:await service(req).create(req.params.tripId,req.body||{})});}catch(error){return next(error);}}
export async function updateBusAssignment(req,res,next){try{return res.json({data:await service(req).update(req.params.tripId,req.params.assignmentId,req.body||{})});}catch(error){return next(error);}}
export async function deleteBusAssignment(req,res,next){try{await service(req).remove(req.params.tripId,req.params.assignmentId);return res.status(204).end();}catch(error){return next(error);}}
