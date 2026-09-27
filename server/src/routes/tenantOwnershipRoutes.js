import { Router } from "express";
import { prismaControl } from "../lib/prismaControl.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth, requireAdmin);

async function appUser(req) {
  const legacyUserId = Number(req.user?.id);
  return prismaControl.appUser.findFirst({
    where: { OR: [
      ...(Number.isInteger(legacyUserId) ? [{ legacyUserId }] : []),
      ...(req.user?.email ? [{ email: req.user.email }] : []),
    ] },
  });
}

async function platformAdmin(req) {
  const user = await appUser(req);
  if (!user) return null;
  const role = await prismaControl.roleAssignment.findFirst({
    where: { userId: user.id, isActive: true, scopeType: "PLATFORM", role: { key: "super_admin" } },
  });
  return role ? user : null;
}

const slugify = value => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const orgView = o => ({ id:o.id,type:o.type,display_name:o.displayName,full_name:o.fullName,abbreviation:o.abbreviation,slug:o.slug,status:o.status });
const tenantView = t => ({ id:t.id,name:t.name,slug:t.slug,status:t.status,subscription_mode:t.subscriptionMode,plan_key:t.planKey });

// Canonical organization creation. Tenant ownership is mandatory.
router.post("/organizations", async (req,res,next) => {
  try {
    const actor = await platformAdmin(req);
    if (!actor) return res.status(403).json({ message:"Platform Super Admin access required" });
    const body=req.body||{}, tenantId=String(body.tenantId||"").trim();
    if (!tenantId) return res.status(400).json({ message:"A tenant is required for every organization" });
    const tenant=await prismaControl.tenant.findUnique({where:{id:tenantId}});
    if (!tenant) return res.status(404).json({ message:"Selected tenant not found" });
    const displayName=String(body.displayName||"").trim(), slug=slugify(body.slug||displayName), type=String(body.type||"").toUpperCase();
    if (!displayName||!slug) return res.status(400).json({message:"Organization display name is required"});
    if (!["SCHOOL_GROUP","SCHOOL","BUS_OPERATOR","SERVICE_PARTNER"].includes(type)) return res.status(400).json({message:"Invalid organization type"});
    if (await prismaControl.organization.findUnique({where:{slug}})) return res.status(409).json({message:"An organization with this slug already exists"});
    const organization=await prismaControl.$transaction(async tx=>{
      const org=await tx.organization.create({data:{type,displayName,fullName:String(body.fullName||"").trim()||null,legalName:String(body.legalName||"").trim()||null,abbreviation:String(body.abbreviation||"").trim()||null,slug,status:"active"}});
      await tx.tenantOrganization.create({data:{tenantId,organizationId:org.id,coverageType:"owner"}});
      await tx.auditEvent.create({data:{actorUserId:actor.id,tenantId,organizationId:org.id,action:"organization.created",resourceType:"organization",resourceId:org.id,metadata:{displayName:org.displayName,type:org.type,tenantId}}});
      return org;
    });
    res.status(201).json({organization:orgView(organization),tenant:tenantView(tenant)});
  } catch(e){next(e)}
});

router.get("/organizations/:organizationId/tenant-ownership", async(req,res,next)=>{
  try {
    if (!(await platformAdmin(req))) return res.status(403).json({message:"Platform Super Admin access required"});
    const [organization,ownership,tenants]=await Promise.all([
      prismaControl.organization.findUnique({where:{id:req.params.organizationId}}),
      prismaControl.tenantOrganization.findMany({where:{organizationId:req.params.organizationId},include:{tenant:true},orderBy:{createdAt:"asc"}}),
      prismaControl.tenant.findMany({where:{status:"active"},orderBy:{name:"asc"}}),
    ]);
    if(!organization)return res.status(404).json({message:"Organization not found"});
    res.json({organization:orgView(organization),tenant:ownership[0]?tenantView(ownership[0].tenant):null,ownership_count:ownership.length,orphan:ownership.length===0,invalid_multiple_owners:ownership.length>1,available_tenants:tenants.map(tenantView)});
  }catch(e){next(e)}
});

// Used both for one-time orphan repair and later tenant-to-tenant transfers.
router.put("/organizations/:organizationId/tenant-ownership", async(req,res,next)=>{
  try {
    const actor=await platformAdmin(req);
    if(!actor)return res.status(403).json({message:"Platform Super Admin access required"});
    const tenantId=String(req.body?.tenantId||"").trim();
    if(!tenantId)return res.status(400).json({message:"Target tenant is required"});
    const [organization,target,current]=await Promise.all([
      prismaControl.organization.findUnique({where:{id:req.params.organizationId}}),
      prismaControl.tenant.findUnique({where:{id:tenantId}}),
      prismaControl.tenantOrganization.findMany({where:{organizationId:req.params.organizationId},include:{tenant:true}}),
    ]);
    if(!organization||!target)return res.status(404).json({message:"Organization or target tenant not found"});
    if(current.length===1&&current[0].tenantId===tenantId)return res.status(409).json({message:"Organization already belongs to this tenant"});
    const oldTenantIds=current.map(x=>x.tenantId);
    await prismaControl.$transaction(async tx=>{
      // Tenant-scoped roles do not automatically follow an organization transfer.
      // Organization memberships/roles remain because they are organization-owned.
      await tx.tenantOrganization.deleteMany({where:{organizationId:organization.id}});
      await tx.tenantOrganization.create({data:{tenantId,organizationId:organization.id,coverageType:"owner"}});
      await tx.auditEvent.create({data:{actorUserId:actor.id,tenantId,organizationId:organization.id,action:current.length?"organization.tenant_transferred":"organization.tenant_assigned",resourceType:"tenant_ownership",resourceId:organization.id,metadata:{fromTenantIds:oldTenantIds,toTenantId:tenantId}}});
    });
    res.json({organization:orgView(organization),tenant:tenantView(target),previous_tenant_ids:oldTenantIds});
  }catch(e){next(e)}
});

// An organization may not be detached from its tenant. Transfer it instead.
router.delete("/tenants/:tenantId/organizations/:organizationId", async(req,res,next)=>{
  try {
    if(!(await platformAdmin(req)))return res.status(403).json({message:"Platform Super Admin access required"});
    const ownership=await prismaControl.tenantOrganization.findFirst({where:{tenantId:req.params.tenantId,organizationId:req.params.organizationId}});
    if(!ownership)return res.status(404).json({message:"Tenant ownership not found"});
    return res.status(409).json({message:"Organizations must always have a tenant. Transfer the organization to another tenant instead."});
  }catch(e){next(e)}
});

// Legacy add-to-tenant action now behaves as an explicit transfer, never multi-tenant coverage.
router.post("/tenants/:tenantId/organizations", async(req,res,next)=>{
  try {
    const actor=await platformAdmin(req);
    if(!actor)return res.status(403).json({message:"Platform Super Admin access required"});
    const organizationId=String(req.body?.organizationId||"").trim();
    if(!organizationId)return res.status(400).json({message:"Organization is required"});
    const [organization,target,current]=await Promise.all([
      prismaControl.organization.findUnique({where:{id:organizationId}}),
      prismaControl.tenant.findUnique({where:{id:req.params.tenantId}}),
      prismaControl.tenantOrganization.findMany({where:{organizationId}}),
    ]);
    if(!organization||!target)return res.status(404).json({message:"Tenant or organization not found"});
    if(current.length===1&&current[0].tenantId===target.id)return res.status(409).json({message:"Organization already belongs to this tenant"});
    await prismaControl.$transaction(async tx=>{
      await tx.tenantOrganization.deleteMany({where:{organizationId}});
      await tx.tenantOrganization.create({data:{tenantId:target.id,organizationId,coverageType:"owner"}});
      await tx.auditEvent.create({data:{actorUserId:actor.id,tenantId:target.id,organizationId,action:current.length?"organization.tenant_transferred":"organization.tenant_assigned",resourceType:"tenant_ownership",resourceId:organizationId,metadata:{fromTenantIds:current.map(x=>x.tenantId),toTenantId:target.id}}});
    });
    res.status(201).json({organization:{...orgView(organization),tenant:tenantView(target)}});
  }catch(e){next(e)}
});

export default router;
