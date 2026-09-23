import { Router } from "express";
import { prismaControl } from "../lib/prismaControl.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth, requireAdmin);

async function appUser(req) {
  const legacyUserId = Number(req.user?.id);
  return prismaControl.appUser.findFirst({ where: { OR: [...(Number.isInteger(legacyUserId) ? [{ legacyUserId }] : []), ...(req.user?.email ? [{ email: req.user.email }] : [])] } });
}
async function requirePlatformAdmin(req) {
  const user = await appUser(req);
  if (!user) return null;
  const assignment = await prismaControl.roleAssignment.findFirst({ where: { userId: user.id, isActive: true, scopeType: "PLATFORM", role: { key: "super_admin" } } });
  return assignment ? user : null;
}
function tenantView(t) {
  return { id:t.id,name:t.name,slug:t.slug,status:t.status,subscription_mode:t.subscriptionMode,plan_key:t.planKey,billing_contact_email:t.billingContactEmail,subscription_start:t.subscriptionStart,subscription_end:t.subscriptionEnd,created_at:t.createdAt };
}

router.get("/overview", async (req,res,next) => {
  try {
    if (!(await requirePlatformAdmin(req))) return res.status(403).json({ message:"Platform Super Admin access required" });
    const now=new Date(), attentionDate=new Date(now); attentionDate.setDate(attentionDate.getDate()+60);
    const [tenants,organizations,users,memberships,relationships,dataSources,coverage] = await Promise.all([
      prismaControl.tenant.findMany({ orderBy:{name:"asc"}, include:{_count:{select:{roleAssignments:true}}} }),
      prismaControl.organization.count(), prismaControl.appUser.count(), prismaControl.organizationMembership.count({where:{status:"ACTIVE"}}),
      prismaControl.organizationRelationship.count({where:{status:"ACTIVE"}}),
      prismaControl.operationalDataSource.findMany({select:{organizationId:true,mode:true,engine:true,providerLabel:true,isActive:true,lastVerifiedAt:true}}),
      prismaControl.tenantOrganization.findMany({select:{tenantId:true,organizationId:true}}),
    ]);
    const orgsByTenant=new Map(); for(const row of coverage){const list=orgsByTenant.get(row.tenantId)||[];list.push(row.organizationId);orgsByTenant.set(row.tenantId,list)}
    const sourcesByOrg=new Map(); for(const source of dataSources){const list=sourcesByOrg.get(source.organizationId)||[];list.push(source);sourcesByOrg.set(source.organizationId,list)}
    const rows=tenants.map(t=>{const orgIds=orgsByTenant.get(t.id)||[],sources=orgIds.flatMap(id=>sourcesByOrg.get(id)||[]),active=sources.filter(s=>s.isActive),end=t.subscriptionEnd?new Date(t.subscriptionEnd):null,days=end?Math.ceil((end-now)/86400000):null;return{...tenantView(t),organization_count:orgIds.length,role_assignment_count:t._count.roleAssignments,data_source_count:sources.length,active_data_source_count:active.length,database_modes:[...new Set(active.map(s=>s.mode))],database_providers:[...new Set(active.map(s=>s.providerLabel||s.engine))],subscription_days_remaining:days,subscription_attention:Boolean(end&&end>=now&&end<=attentionDate),subscription_expired:Boolean(end&&end<now)}});
    return res.json({ scope:"PLATFORM", metrics:{tenants:tenants.length,active_tenants:tenants.filter(t=>String(t.status).toLowerCase()==="active").length,organizations,users,active_memberships:memberships,relationships,data_sources:dataSources.length,active_data_sources:dataSources.filter(s=>s.isActive).length,subscriptions_needing_attention:rows.filter(t=>t.subscription_attention||t.subscription_expired).length}, tenants:rows });
  } catch(e){ next(e); }
});

export default router;
