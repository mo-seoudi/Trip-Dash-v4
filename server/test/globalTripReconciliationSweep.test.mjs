import test from "node:test";
import assert from "node:assert/strict";
import { reconcileSchoolTripBatch, reconcileSchoolTripSweep } from "../src/services/globalTripReconciliationSweep.js";

function fixture(ids) {
  const calls=[];
  const getContext=async()=>({
    dataSource:{id:"source-1"},
    prisma:{trip:{findMany:async({where,take})=>ids.filter(id=>id>where.id.gt).slice(0,take).map(id=>({id,globalTripId:null}))}},
  });
  return { calls,getContext,reconcile:async({localTripId})=>{calls.push(localTripId);if(localTripId===2)throw Object.assign(new Error("temporary"),{code:"TEMPORARY"});}};
}
test("sweep scans every trip even after a registration failure",async()=>{
  const f=fixture([1,2,3,4,5]);
  const result=await reconcileSchoolTripSweep({schoolId:"school",limit:2,getContext:f.getContext,reconcile:f.reconcile});
  assert.deepEqual(f.calls,[1,2,3,4,5]);
  assert.equal(result.scanned,5);
  assert.equal(result.registered,4);
  assert.deepEqual(result.failed,[{tripId:2,code:"TEMPORARY"}]);
  assert.equal(result.complete,true);
});
test("batch returns a stable restart cursor",async()=>{
  const f=fixture([1,2,3]);
  const batch=await reconcileSchoolTripBatch({schoolId:"school",cursor:1,limit:1,getContext:f.getContext,reconcile:f.reconcile});
  assert.equal(batch.nextCursor,2);
  assert.equal(batch.hasMore,true);
});
test("invalid pagination parameters fail before querying",async()=>{
  const f=fixture([1]);
  await assert.rejects(reconcileSchoolTripBatch({schoolId:"school",cursor:-1,getContext:f.getContext,reconcile:f.reconcile}),/Invalid cursor/);
  await assert.rejects(reconcileSchoolTripBatch({schoolId:"school",limit:501,getContext:f.getContext,reconcile:f.reconcile}),/Invalid batch limit/);
});
