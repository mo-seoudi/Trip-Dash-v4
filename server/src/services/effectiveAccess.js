// Canonical effective-access resolver.
// Roles provide baseline permissions; explicit user permission grants add
// organization-scoped privileges without changing a person's role/job type.
import { permissionsForRoles, ROLE_KEYS } from "./accessCatalog.js";

const activeStatus=v=>String(v||"").trim().toLowerCase()==="active";
const activeMembership=r=>String(r?.status||"").trim().toUpperCase()==="ACTIVE";
function activeRelationship(r,now=new Date()){if(!activeStatus(r?.status))return false;if(r.validFrom&&new Date(r.validFrom)>now)return false;if(r.validUntil&&new Date(r.validUntil)<now)return false;return true;}
const roleKey=a=>a?.role?.key||null;
const orgView=o=>({id:o.id,type:o.type,displayName:o.displayName,fullName:o.fullName||o.displayName,abbreviation:o.abbreviation||null});
function addWorkspace(map,org,role,detail){if(!org||org.type!=="SCHOOL"||!role)return;const c=map.get(org.id)||{organization:orgView(org),roles:new Set(),access:[]};c.roles.add(role);const s=JSON.stringify(detail);if(!c.access.some(x=>JSON.stringify(x)===s))c.access.push(detail);map.set(org.id,c);}
function addOrganization(map,org,detail){if(!org)return;const c=map.get(org.id)||{organization:orgView(org),access:[]};const s=JSON.stringify(detail);if(!c.access.some(x=>JSON.stringify(x)===s))c.access.push(detail);map.set(org.id,c);}
function inheritedGroupRole(r){if(r===ROLE_KEYS.FINANCE)return ROLE_KEYS.FINANCE;if(r===ROLE_KEYS.TENANT_ADMIN)return ROLE_KEYS.TENANT_ADMIN;return ROLE_KEYS.GROUP_STAFF;}
const inheritedOperatorRole=r=>r===ROLE_KEYS.FINANCE?ROLE_KEYS.FINANCE:ROLE_KEYS.BUS_OPERATOR;
const inheritedPartnerRole=r=>r===ROLE_KEYS.FINANCE?ROLE_KEYS.FINANCE:ROLE_KEYS.SERVICE_PARTNER;
async function activeChildrenOfGroups(prisma,ids,now){const out=new Set();for(const id of ids){const rows=await prisma.organizationRelationship.findMany({where:{toOrganizationId:id,type:"BELONGS_TO_GROUP"},include:{fromOrganization:true}});for(const r of rows.filter(x=>activeRelationship(x,now)))out.add(r.fromOrganizationId||r.fromOrganization?.id);}return out;}
async function transportSchoolsForOperator(prisma,id,now){const canonical=await prisma.organizationRelationship.findMany({where:{toOrganizationId:id,type:"TRANSPORT_PROVIDER"},include:{fromOrganization:true}});const reversed=await prisma.organizationRelationship.findMany({where:{fromOrganizationId:id,type:"TRANSPORT_PROVIDER"},include:{toOrganization:true}});const out=[];for(const r of canonical.filter(x=>activeRelationship(x,now)))if(r.fromOrganization?.type==="SCHOOL")out.push({relationship:r,school:r.fromOrganization,direction:"canonical"});for(const r of reversed.filter(x=>activeRelationship(x,now)))if(r.toOrganization?.type==="SCHOOL")out.push({relationship:r,school:r.toOrganization,direction:"legacy_reversed"});return out;}

export async function resolveEffectiveAccess(prisma,identity,{now=new Date()}={}){
  if(!prisma)throw new Error("Canonical control-plane Prisma client is required");
  const legacyUserId=Number(identity?.id),email=String(identity?.email||"").trim();
  const selectors=[...(Number.isInteger(legacyUserId)&&legacyUserId>0?[{legacyUserId}]:[]),...(email?[{email}]:[])];
  const empty={source:"canonical",user:null,roles:[],permissions:[],organizations:[],workspaces:[],portfolio:{enabled:false,schoolCount:0}};
  if(!selectors.length)return empty;
  const user=await prisma.appUser.findFirst({where:{OR:selectors},include:{memberships:{include:{organization:true}},roleAssignments:{include:{role:true,organization:true,tenant:true}},permissionGrants:{include:{permission:true,organization:true}}}});
  if(!user||!activeStatus(user.status))return{...empty,user:user?{id:String(identity?.id||""),appUserId:user.id,email:user.email,displayName:user.displayName}:null};
  const memberships=(user.memberships||[]).filter(activeMembership),memberOrgIds=new Set(memberships.map(x=>x.organizationId));
  const memberGroupIds=memberships.filter(x=>x.organization?.type==="SCHOOL_GROUP").map(x=>x.organizationId),childSchoolIds=await activeChildrenOfGroups(prisma,memberGroupIds,now);
  const assignments=(user.roleAssignments||[]).filter(x=>x.isActive&&roleKey(x)),platformAssignments=assignments.filter(x=>x.scopeType==="PLATFORM"),tenantAssignments=assignments.filter(x=>x.scopeType==="TENANT");
  const validAssignments=assignments.filter(x=>x.scopeType==="ORGANIZATION"&&x.organizationId).filter(x=>memberOrgIds.has(x.organizationId)||childSchoolIds.has(x.organizationId));
  const directGrants=(user.permissionGrants||[]).filter(x=>x.isActive&&x.permission?.key&&memberOrgIds.has(x.organizationId));
  const workspaceMap=new Map(),organizationMap=new Map();
  for(const m of memberships)addOrganization(organizationMap,m.organization,{kind:"membership",viaOrganizationId:m.organizationId});
  for(const a of validAssignments){const d={kind:"direct",role:roleKey(a),viaOrganizationId:a.organizationId};addOrganization(organizationMap,a.organization,d);if(a.organization?.type==="SCHOOL")addWorkspace(workspaceMap,a.organization,roleKey(a),d);}
  for(const a of validAssignments.filter(x=>x.organization?.type==="SCHOOL_GROUP")){const rows=await prisma.organizationRelationship.findMany({where:{toOrganizationId:a.organizationId,type:"BELONGS_TO_GROUP"},include:{fromOrganization:true}});for(const r of rows.filter(x=>activeRelationship(x,now))){const role=inheritedGroupRole(roleKey(a)),d={kind:"relationship",role,viaOrganizationId:a.organizationId,viaRelationship:"BELONGS_TO_GROUP"};addWorkspace(workspaceMap,r.fromOrganization,role,d);addOrganization(organizationMap,r.fromOrganization,d);}}
  for(const a of validAssignments.filter(x=>x.organization?.type==="BUS_OPERATOR")){for(const link of await transportSchoolsForOperator(prisma,a.organizationId,now)){const role=inheritedOperatorRole(roleKey(a)),d={kind:"relationship",role,viaOrganizationId:a.organizationId,viaRelationship:"TRANSPORT_PROVIDER",relationshipDirection:link.direction,transportProviderOrganizationId:a.organizationId};addWorkspace(workspaceMap,link.school,role,d);addOrganization(organizationMap,link.school,d);}}
  for(const a of validAssignments.filter(x=>x.organization?.type==="SERVICE_PARTNER")){const rows=await prisma.organizationRelationship.findMany({where:{toOrganizationId:a.organizationId,type:"TRIP_MANAGER"},include:{fromOrganization:true}});for(const r of rows.filter(x=>activeRelationship(x,now))){const role=inheritedPartnerRole(roleKey(a)),d={kind:"relationship",role,viaOrganizationId:a.organizationId,viaRelationship:"TRIP_MANAGER",managingOrganizationId:a.organizationId};addWorkspace(workspaceMap,r.fromOrganization,role,d);addOrganization(organizationMap,r.fromOrganization,d);}}
  // A direct permission grant never creates access to an organization by itself:
  // the user must already be an active member. It only augments that workspace.
  const grantsByOrg=new Map();for(const g of directGrants){const set=grantsByOrg.get(g.organizationId)||new Set();set.add(g.permission.key);grantsByOrg.set(g.organizationId,set);if(g.organization?.type==="SCHOOL"&&!workspaceMap.has(g.organizationId)){const d={kind:"permission_grant",viaOrganizationId:g.organizationId};addWorkspace(workspaceMap,g.organization,ROLE_KEYS.SCHOOL_STAFF,d);}}
  const workspaces=[...workspaceMap.values()].sort((a,b)=>a.organization.displayName.localeCompare(b.organization.displayName)).map(({organization,roles,access})=>{const resolvedRoles=[...roles].sort(),grants=[...(grantsByOrg.get(organization.id)||[])].sort();return{schoolId:organization.id,displayName:organization.displayName,fullName:organization.fullName,abbreviation:organization.abbreviation,roles:resolvedRoles,permissions:[...new Set([...permissionsForRoles(resolvedRoles),...grants])].sort(),permissionGrants:grants,access};});
  const operationalRoles=[...new Set(validAssignments.map(roleKey).filter(Boolean))].sort(),organizations=[...organizationMap.values()].sort((a,b)=>a.organization.displayName.localeCompare(b.organization.displayName)).map(({organization,access})=>({...organization,access}));
  return{source:"canonical",user:{id:String(identity?.id||""),appUserId:user.id,email:user.email,displayName:user.displayName},roles:operationalRoles,permissions:permissionsForRoles([...operationalRoles,...platformAssignments.map(roleKey)]),organizations,workspaces,platformAccess:{roles:[...new Set(platformAssignments.map(roleKey).filter(Boolean))].sort(),tenantScopes:tenantAssignments.map(x=>({tenantId:x.tenantId,role:roleKey(x)}))},portfolio:{enabled:workspaces.length>0,schoolCount:workspaces.length}};
}
