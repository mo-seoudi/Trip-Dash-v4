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
export default router;
