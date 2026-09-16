// Approval routing authorization shared by the quotation workflow.
// An internal approver must be a real active AppUser whose effective access to
// the same school workspace includes trip.approve_quote. We resolve through the
// same legacy/shadow/canonical runtime boundary used by normal requests so the
// migration cannot accidentally broaden approval authority.
import { prismaGlobal } from "../lib/prismaGlobal.js";
import { PERMISSIONS } from "./accessCatalog.js";
import { resolveRuntimeAccess } from "./accessRuntime.js";
import { workspaceFromAccess } from "./workspaceOperationalContext.js";

function httpError(status,message,code){const error=new Error(message);error.status=status;error.code=code;return error;}

export async function validateInternalQuotationApprover({appUserId,schoolId,globalPrisma=prismaGlobal,resolveAccess=resolveRuntimeAccess}={}){
  const id=String(appUserId||"").trim();
  if(!id)throw httpError(400,"Internal approver is required","APPROVER_REQUIRED");
  const globalUser=await globalPrisma.user.findFirst({where:{id},select:{id:true,email:true,isActive:true,legacyUserId:true}});
  if(!globalUser||!globalUser.isActive||!globalUser.legacyUserId)throw httpError(400,"Selected internal approver is not an active application user","APPROVER_INVALID");
  const access=await resolveAccess({user:{id:globalUser.legacyUserId,email:globalUser.email}});
  let workspace;
  try{workspace=workspaceFromAccess(access,schoolId,PERMISSIONS.TRIP_APPROVE_QUOTE);}catch(error){
    if(error?.status===403)throw httpError(400,"Selected user is not authorized to approve quotations for this school","APPROVER_NOT_AUTHORIZED");
    throw error;
  }
  return{appUserId:id,email:globalUser.email,workspace};
}
