import { createOperationalService } from "../../runtime/operationalService.js";
import { createBookingService } from "./bookingService.js";
const service = req => createOperationalService(req.operational, createBookingService);
export async function listBookings(req,res,next){try{return res.json({data:await service(req).list()});}catch(e){return next(e);}}
export async function getBooking(req,res,next){try{return res.json({data:await service(req).get(req.params.bookingId)});}catch(e){return next(e);}}
export async function createBooking(req,res,next){try{return res.status(201).json({data:await service(req).create(req.body||{})});}catch(e){return next(e);}}
export async function updateBooking(req,res,next){try{return res.json({data:await service(req).update(req.params.bookingId,req.body||{})});}catch(e){return next(e);}}
export async function deleteBooking(req,res,next){try{return res.json({data:await service(req).remove(req.params.bookingId)});}catch(e){return next(e);}}
