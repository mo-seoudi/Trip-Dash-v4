import { Router } from "express";
import { operationalPrismaForExternalAction } from "../services/workspaceOperationalContext.js";
import { EXTERNAL_ACTIONS, consumeExternalWorkflowAction, resolveExternalWorkflowAction } from "../services/externalWorkflowActions.js";

// Public-by-design endpoints: authorization is the scoped, expiring bearer token.
// The DB resolver is kept behind a dedicated service so tokens never contain DB
// credentials or routing information.
const router = Router();
const cleanToken = (req) => String(req.body?.token || req.query?.token || "").trim();

async function decide(req,res,next,decision){try{
  const token=cleanToken(req);if(!token)return res.status(400).json({message:"Action token is required"});
  const routed=await operationalPrismaForExternalAction(token);if(!routed)return res.status(404).json({message:"This action link is invalid or expired"});
  const required=decision==="approved"?EXTERNAL_ACTIONS.APPROVE_QUOTATION:EXTERNAL_ACTIONS.DECLINE_QUOTATION;
  const action=await resolveExternalWorkflowAction({prisma:routed.prisma,token,requiredAction:required});if(!action)return res.status(410).json({message:"This action link is invalid, expired, revoked, or already used"});
  const result=await routed.prisma.$transaction(async tx=>{
    const approval=await tx.tripApprovalRequest.findFirst({where:{id:action.approvalRequestId,tripId:action.tripId,quotationId:action.quotationId,status:"pending"}});if(!approval)throw Object.assign(new Error("Approval request is no longer pending"),{status:409});
    const quotation=await tx.tripQuotation.findFirst({where:{id:action.quotationId,tripId:action.tripId,status:"submitted"}});if(!quotation)throw Object.assign(new Error("Quotation is no longer awaiting approval"),{status:409});
    const decided=await tx.tripApprovalRequest.update({where:{id:approval.id},data:{status:decision,decidedAt:new Date(),decidedByExternalEmail:action.recipientEmail,decisionNote:String(req.body?.note||"").trim()||null}});
    if(decision==="approved"){
      await tx.tripQuotation.update({where:{id:quotation.id},data:{status:"approved"}});await tx.trip.update({where:{id:action.tripId},data:{status:"Approved"}});
      await tx.tripApprovalRequest.updateMany({where:{quotationId:quotation.id,status:"pending",id:{not:approval.id}},data:{status:"superseded",decidedAt:new Date(),decisionNote:"Quotation approved through another approval request"}});
    }
    await consumeExternalWorkflowAction({prisma:tx,id:action.id});return decided;
  });
  return res.json({tripId:action.tripId,quotationId:action.quotationId,decision,approvalRequestId:result.id});
}catch(e){next(e);}}
router.post("/quotation/approve",(req,res,next)=>decide(req,res,next,"approved"));
router.post("/quotation/decline",(req,res,next)=>decide(req,res,next,"declined"));
export default router;
