import { Router } from "express";
import { prismaControl } from "../lib/prismaControl.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
const router=Router();
router.use(requireAuth,requireAdmin);
async function platformAdmin(req){
 const legacyUserId=Number(req.user?.id);
 const user=await prismaControl.appUser.findFirst({where:{OR:[...(Number.isInteger(legacyUserId)?[{legacyUserId}]:[]),...(req.user?.email?[{email:req.user.email}]:[])]}});
 return user&&await prismaControl.roleAssignment.findFirst({where:{userId:user.id,isActive:true,scopeType:"PLATFORM",role:{key:"super_admin"}}})?user:null;
}
router.get("/",async(req,res,next)=>{try{
 if(!await platformAdmin(req))return res.status(403).json({message:"Platform Super Admin access required"});
 const providers=await prismaControl.$queryRaw`
 SELECT o.id,o.display_name,o.abbreviation,o.country_code,o.region_code,o.created_source,o.claim_status,o.verification_status,o.operational_status,o.directory_visible
 FROM public.organizations o WHERE o.type='BUS_OPERATOR' ORDER BY o.display_name
 `;
 res.json({providers});
}catch(e){next(e)}});

// Directory-only provider creation. No tenant ownership or platform account is created.
router.post("/",async(req,res,next)=>{try{
 const actor=await platformAdmin(req);
 if(!actor)return res.status(403).json({message:"Platform Super Admin access required"});
 const body=req.body||{};
 const displayName=String(body.displayName||"").trim();
 const slug=String(body.slug||displayName).trim().toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
 if(!displayName||!slug)return res.status(400).json({message:"Provider display name is required"});
 const duplicate=await prismaControl.organization.findFirst({where:{OR:[{slug},{displayName:{equals:displayName,mode:"insensitive"}}]}});
 if(duplicate)return res.status(409).json({message:"An organization with this name or slug already exists",organizationId:duplicate.id});
 const org=await prismaControl.$transaction(async tx=>{
  const created=await tx.organization.create({data:{type:"BUS_OPERATOR",displayName,fullName:String(body.fullName||"").trim()||null,legalName:String(body.legalName||"").trim()||null,abbreviation:String(body.abbreviation||"").trim()||null,slug,status:"active"}});
  await tx.auditEvent.create({data:{actorUserId:actor.id,organizationId:created.id,action:"provider.directory_listed",resourceType:"organization",resourceId:created.id,metadata:{createdSource:"provider_directory",tenantAssigned:false}}});
  return created;
 });
 res.status(201).json({provider:{id:org.id,display_name:org.displayName,type:org.type,status:org.status}});
}catch(e){next(e)}});

router.get("/:organizationId/invitations",async(req,res,next)=>{try{
 const actor=await platformAdmin(req);if(!actor)return res.status(403).json({message:"Platform Super Admin access required"});
 const org=await prismaControl.organization.findUnique({where:{id:req.params.organizationId}});
 if(!org||org.type!=="BUS_OPERATOR")return res.status(404).json({message:"Transport provider not found"});
 const invitations=await prismaControl.$queryRaw`SELECT id,email,display_name,role_key,status,delivery_status,created_at,expires_at FROM public.provider_account_invitations WHERE organization_id=${org.id}::uuid ORDER BY created_at DESC`;
 res.json({invitations});
}catch(e){next(e)}});
router.post("/:organizationId/invitations",async(req,res,next)=>{try{
 const actor=await platformAdmin(req);if(!actor)return res.status(403).json({message:"Platform Super Admin access required"});
 const org=await prismaControl.organization.findUnique({where:{id:req.params.organizationId}});
 if(!org||org.type!=="BUS_OPERATOR")return res.status(404).json({message:"Transport provider not found"});
 const email=String(req.body?.email||"").trim().toLowerCase(),displayName=String(req.body?.displayName||"").trim(),roleKey=String(req.body?.roleKey||"").trim();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!displayName||!roleKey)return res.status(400).json({message:"Valid email, representative name and role are required"});
 const role=await prismaControl.role.findUnique({where:{key:roleKey}});
 if(!role||roleKey==="super_admin")return res.status(400).json({message:"Invalid provider role"});
 const existing=await prismaControl.organizationMembership.findFirst({where:{organizationId:org.id,status:"ACTIVE",user:{email}}});
 if(existing)return res.status(409).json({message:"This user already has active access to the provider"});
 const rows=await prismaControl.$queryRaw`
 INSERT INTO public.provider_account_invitations(organization_id,email,display_name,role_key,created_by)
 VALUES (${org.id}::uuid,${email},${displayName},${roleKey},${actor.id}::uuid)
 ON CONFLICT (organization_id,email) WHERE status='pending' DO NOTHING
 RETURNING id,email,display_name,role_key,status,delivery_status,created_at,expires_at`;
 if(!rows.length)return res.status(409).json({message:"A pending invitation already exists for this provider and email"});
 await prismaControl.auditEvent.create({data:{actorUserId:actor.id,organizationId:org.id,action:"provider.invitation_created",resourceType:"provider_account_invitation",resourceId:rows[0].id,metadata:{email,roleKey,deliveryStatus:"not_configured"}}});
 res.status(201).json({invitation:rows[0],message:"Invitation saved as pending. Email delivery is not configured; no access granted."});
}catch(e){next(e)}});
router.post("/:organizationId/invitations/:invitationId/cancel",async(req,res,next)=>{try{
 const actor=await platformAdmin(req);if(!actor)return res.status(403).json({message:"Platform Super Admin access required"});
 const rows=await prismaControl.$queryRaw`
 UPDATE public.provider_account_invitations SET status='cancelled',updated_at=now()
 WHERE id=${req.params.invitationId}::uuid AND organization_id=${req.params.organizationId}::uuid AND status='pending'
 RETURNING id`;
 if(!rows.length)return res.status(404).json({message:"Pending invitation not found"});
 await prismaControl.auditEvent.create({data:{actorUserId:actor.id,organizationId:req.params.organizationId,action:"provider.invitation_cancelled",resourceType:"provider_account_invitation",resourceId:rows[0].id}});
 res.json({cancelled:true});
}catch(e){next(e)}});
export default router;
