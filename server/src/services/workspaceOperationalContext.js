// Authorized workspace -> operational PostgreSQL context.
import { prismaControl } from "../lib/prismaControl.js";
import { resolveRuntimeAccess } from "./accessRuntime.js";
import { assertPostgresCompatibleDataSource } from "./operationalDataSource.js";
import { prismaForOperationalDataSource } from "./operationalPrismaPool.js";

function httpError(status,message,code){const error=new Error(message);error.status=status;if(code)error.code=code;return error;}

export function workspaceFromAccess(access,schoolId,requiredPermission=null){
  const requestedSchoolId=String(schoolId||"").trim();
  if(!requestedSchoolId)throw httpError(400,"A school workspace is required","SCHOOL_WORKSPACE_REQUIRED");
  const workspace=(access?.workspaces||[]).find(item=>item.schoolId===requestedSchoolId);
  if(!workspace)throw httpError(403,"You do not have access to this school workspace","SCHOOL_WORKSPACE_FORBIDDEN");
  if(requiredPermission&&!(workspace.permissions||[]).includes(requiredPermission))throw httpError(403,"You do not have permission for this action in this school workspace","WORKSPACE_PERMISSION_FORBIDDEN");
  return workspace;
}

export function activeCanonicalDataSourceWhere(_access,workspace){
  if(!workspace?.schoolId)throw httpError(403,"Workspace routing context is incomplete","WORKSPACE_ROUTING_FORBIDDEN");
  return{organizationId:workspace.schoolId,isActive:true};
}

export function singleActiveWorkspaceConnection(connections=[]){
  if(!connections.length)throw httpError(503,"No active operational database is configured for this school","DATA_SOURCE_NOT_CONFIGURED");
  if(connections.length>1)throw httpError(503,"More than one active operational database is configured for this school","DATA_SOURCE_AMBIGUOUS");
  return connections[0];
}

export async function authorizeSchoolWorkspace(user,schoolId,requiredPermission=null,resolveAccess=resolveRuntimeAccess){
  const access=await resolveAccess({user});
  const workspace=workspaceFromAccess(access,schoolId,requiredPermission);
  return{access,workspace};
}

export async function resolveWorkspaceDataSource(user,schoolId,requiredPermission=null,{controlPrisma=prismaControl,resolveAccess=resolveRuntimeAccess}={}){
  const{access,workspace}=await authorizeSchoolWorkspace(user,schoolId,requiredPermission,resolveAccess);
  if(!controlPrisma)throw httpError(503,"Canonical control plane is unavailable","CANONICAL_ACCESS_UNAVAILABLE");
  const rows=await controlPrisma.operationalDataSource.findMany({where:activeCanonicalDataSourceWhere(access,workspace),orderBy:{updatedAt:"desc"}});
  const dataSource=singleActiveWorkspaceConnection(rows);
  try{return{access,workspace,dataSource:assertPostgresCompatibleDataSource(dataSource)}}
  catch(error){if(!error.code)error.code="CANONICAL_DATA_SOURCE_INVALID";throw error;}
}

export async function operationalPrismaForWorkspace(user,schoolId,requiredPermission=null){
  const context=await resolveWorkspaceDataSource(user,schoolId,requiredPermission);
  const prisma=await prismaForOperationalDataSource(context.dataSource);
  return{...context,prisma};
}

// External email links have no authenticated user. Routing therefore uses only
// the public workspace identifier and still fails closed unless exactly one
// active data source exists. The action token subsequently authorizes the exact
// trip/quotation/action; this function grants no resource access by itself.
export async function operationalPrismaForExternalWorkspace(schoolId,{controlPrisma=prismaControl}={}){
  const id=String(schoolId||"").trim();
  if(!id)throw httpError(400,"A school workspace is required","SCHOOL_WORKSPACE_REQUIRED");
  if(!controlPrisma)throw httpError(503,"Canonical control plane is unavailable","CANONICAL_ACCESS_UNAVAILABLE");
  const rows=await controlPrisma.operationalDataSource.findMany({where:{organizationId:id,isActive:true},orderBy:{updatedAt:"desc"}});
  const dataSource=assertPostgresCompatibleDataSource(singleActiveWorkspaceConnection(rows));
  const prisma=await prismaForOperationalDataSource(dataSource);
  return{schoolId:id,dataSource,prisma};
}
