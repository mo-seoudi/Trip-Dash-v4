import test from "node:test";
import assert from "node:assert/strict";
import { reconcileGlobalTrip } from "../src/services/globalTripRegistryService.js";

const schoolId="ba6782ab-44e2-4284-a3de-4e334cf8f00f";
const tenantId="63b4f63c-b42b-4526-b38d-d0d2e6e84a6a";
const sourceId="8e95a43a-59b0-459c-9398-5c985095dd4d";
const globalId="f6ad9c63-3b1d-4a3c-8bb9-1300d79df728";

function fixture({ coverageCount=1, owner=schoolId, existingId=null }={}) {
  const trip={id:12,globalTripId:null,transportProviderOrganizationId:null};
  const registry=new Map();
  if(existingId)registry.set("12",{id:existingId});
  const prisma={trip:{
    findFirst:async ({where})=>where.owningSchoolOrganizationId===owner?{...trip}:null,
    updateMany:async ({where,data})=>{if(trip.globalTripId===null){trip.globalTripId=data.globalTripId;return {count:1}}return {count:0}},
  }};
  const control={
    tenantOrganization:{findMany:async()=>Array.from({length:coverageCount},()=>({tenantId}))},
    globalTripRegistry:{
      findFirst:async()=>registry.get("12")||null,
      findUnique:async ({where})=>registry.get("12")?.id===where.id?registry.get("12"):null,
      upsert:async ({where,create,update})=>{
        const row=registry.get("12");
        if(row){Object.assign(row,update);return {...row}}
        registry.set("12",{...create});return {...create};
      },
    },
  };
  return {control,getContext:async()=>({prisma,dataSource:{id:sourceId}}),trip,registry};
}

test("assigns a UUID and registers the trip, safely retrying",async()=>{
  const f=fixture();
  const args={schoolId,localTripId:12,control:f.control,getContext:f.getContext,newId:()=>globalId};
  const first=await reconcileGlobalTrip(args);
  const second=await reconcileGlobalTrip(args);
  assert.equal(first.globalTripId,globalId);
  assert.equal(second.globalTripId,globalId);
  assert.equal(f.registry.size,1);
  assert.equal(f.registry.get("12").busCompanyOrgId,null);
});
test("rejects ambiguous tenant mappings",async()=>{
  const f=fixture({coverageCount:2});
  await assert.rejects(reconcileGlobalTrip({schoolId,localTripId:12,control:f.control,getContext:f.getContext}),{code:"TENANT_MAPPING_AMBIGUOUS"});
});
test("rejects cross-school trip access",async()=>{
  const f=fixture({owner:"81ac7032-1620-4c6a-86a0-671251e8fc99"});
  await assert.rejects(reconcileGlobalTrip({schoolId,localTripId:12,control:f.control,getContext:f.getContext}),{code:"TRIP_NOT_FOUND"});
});
test("rejects a conflicting registry identity",async()=>{
  const f=fixture({existingId:"a66b6cb5-1d36-4eaf-93a4-24c9dd258aae"});
  await assert.rejects(reconcileGlobalTrip({schoolId,localTripId:12,control:f.control,getContext:f.getContext,newId:()=>globalId}),{code:"REGISTRY_IDENTITY_CONFLICT"});
});
