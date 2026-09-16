// Approval routing authorization shared by the quotation workflow.
// Internal approvers are returned only after their effective access to the
// requested school is resolved through the same runtime boundary as normal API
// authorization. A user directory entry alone never makes someone an approver.
import { prismaGlobal } from "../lib/prismaGlobal.js";
import { PERMISSIONS } from "./accessCatalog.js";
import { resolveRuntimeAccess } from "./accessRuntime.js";
import { workspaceFromAccess } from "./workspaceOperationalContext.js";

function httpError(status,message,code){const error=new Error(message);error.status=status;error.code=code;return error;}

async function authorizedWorkspace({globalUser,schoolId,resolveAccess}){
  if(!globalUser?.isActive||!globalUser?.legacyUserId)return null;
  const access=await resolveAccess({user:{id:globalUser.legacyUserId,email:globalUser.email}});
  try{return workspaceFromAccess(access,schoolId,PERMISSIONS.TRIP_APPROVE_QUOTE);}catch(error){if(error?.status===403)return null;throw error;}
}

export async function validateInternalQuotationApprover({appUserId,schoolId,globalPrisma=prismaGlobal,resolveAccess=resolveRuntimeAccess}={}){
  const id=String(appUserId||"").trim();
  if(!id)throw httpError(400,"Internal approver is required","APPROVER_REQUIRED");
  const globalUser=await globalPrisma.user.findFirst({where:{id},select:{id:true,email:true,fullName:true,isActive:true,legacyUserId:true}});
  if(!globalUser||!globalUser.isActive||!globalUser.legacyUserId)throw httpError(400,"Selected internal approver is not an active application user","APPROVER_INVALID");
  const workspace=await authorizedWorkspace({globalUser,schoolId,resolveAccess});
  if(!workspace)throw httpError(400,"Selected user is not authorized to approve quotations for this school","APPROVER_NOT_AUTHORIZED");
  return{appUserId:id,email:globalUser.email,fullName:globalUser.fullName||null,workspace};
}

export async function listInternalQuotationApprovers({schoolId,globalPrisma=prismaGlobal,resolveAccess=resolveRuntimeAccess}={}){
  const users=await globalPrisma.user.findMany({where:{isActive:true,legacyUserId:{not:null}},select:{id:true,email:true,fullName:true,isActive:true,legacyUserId:true},orderBy:[{fullName:"asc"},{email:"asc"}]});
  const eligible=[];
  // Resolve individually and fail closed. This is intentionally authorization-
  // driven rather than role-name-driven so scoped/group assignments work too.
  for(const globalUser of users){
    const workspace=await authorizedWorkspace({globalUser,schoolId,resolveAccess});
    if(workspace)eligible.push({appUserId:globalUser.id,email:globalUser.email,fullName:globalUser.fullName||null});
  }
  return eligible;
}
