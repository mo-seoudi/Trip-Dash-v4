import React from"react";
import{useParams}from"react-router-dom";
import TenantOwnershipCard from"@/components/admin/TenantOwnershipCard.jsx";
import OrganizationControlCenter from"./OrganizationControlCenter.jsx";

export default function OrganizationAdminPage(){
 const{organizationId}=useParams();
 return <>
  <div className="px-4 pt-4 md:px-6 md:pt-6">
   <section className="rounded-2xl border bg-white shadow-sm">
    <div className="border-b px-5 py-4"><h2 className="font-bold text-slate-900">Tenant ownership</h2><p className="mt-0.5 text-xs text-slate-500">Every organization belongs to one top-level tenant.</p></div>
    <div className="p-4"><TenantOwnershipCard organizationId={organizationId}/></div>
   </section>
  </div>
  <OrganizationControlCenter/>
 </>;
}
