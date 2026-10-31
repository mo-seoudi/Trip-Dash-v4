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
export default router;
