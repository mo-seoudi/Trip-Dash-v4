// Approval routing authorization shared by the quotation workflow.
// Internal approvers are canonical Control Plane users and are returned only
// after their effective access to the requested school is authorized.
import { prismaControl } from "../lib/prismaControl.js";
import { PERMISSIONS } from "./accessCatalog.js";
import { resolveRuntimeAccess } from "./accessRuntime.js";
import { workspaceFromAccess } from "./workspaceOperationalContext.js";

function httpError(status,message,code){const error=new Error(message);error.status=status;error.code=code;return error;}
function isActive(user){return user?.status==="active";}

async function authorizedWorkspace({appUser,schoolId,resolveAccess}){
  if(!isActive(appUser))return null;
  const access=await resolveAccess({user:{id:appUser.id,email:appUser.email}});
  try{return workspaceFromAccess(access,schoolId,PERMISSIONS.TRIP_APPROVE_QUOTE);}catch(error){if(error?.status===403)return null;throw error;}
}

export async function validateInternalQuotationApprover({appUserId,schoolId,controlPrisma=prismaControl,resolveAccess=resolveRuntimeAccess}={}){
  const id=String(appUserId||"").trim();
  if(!id)throw httpError(400,"Internal approver is required","APPROVER_REQUIRED");
  const appUser=await controlPrisma.appUser.findFirst({where:{id},select:{id:true,email:true,displayName:true,status:true}});
  if(!isActive(appUser))throw httpError(400,"Selected internal approver is not an active application user","APPROVER_INVALID");
  const workspace=await authorizedWorkspace({appUser,schoolId,resolveAccess});
  if(!workspace)throw httpError(400,"Selected user is not authorized to approve quotations for this school","APPROVER_NOT_AUTHORIZED");
  return{appUserId:id,email:appUser.email,fullName:appUser.displayName||null,workspace};
}

export async function listInternalQuotationApprovers({schoolId,controlPrisma=prismaControl,resolveAccess=resolveRuntimeAccess}={}){
  const users=await controlPrisma.appUser.findMany({where:{status:"active"},select:{id:true,email:true,displayName:true,status:true},orderBy:[{displayName:"asc"},{email:"asc"}]});
  const eligible=[];
  for(const appUser of users){
    const workspace=await authorizedWorkspace({appUser,schoolId,resolveAccess});
    if(workspace)eligible.push({appUserId:appUser.id,email:appUser.email,fullName:appUser.displayName||null});
  }
  return eligible;
}
