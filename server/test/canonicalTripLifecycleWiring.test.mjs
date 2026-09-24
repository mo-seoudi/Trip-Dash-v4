import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read=p=>fs.readFileSync(new URL(`../${p}`,import.meta.url),"utf8");

test("canonical trip workflow never queries removed cancelRequest field",()=>{
  const workflow=read("src/domain/trips/tripWorkflowController.js");
  assert.equal(workflow.includes("cancelRequest"),false);
});

test("passenger services scope by school rather than removed tenantId",()=>{
  for(const path of ["src/domain/trips/passengerService.js","src/domain/trips/passengerAllocationService.js"]){
    const source=read(path);
    assert.equal(source.includes("tenantId"),false,path);
    assert.match(source,/owningSchoolOrganizationId/);
  }
});

test("passenger allocation writes canonical tripId",()=>{
  const source=read("src/domain/trips/passengerAllocationService.js");
  assert.match(source,/tripId:id/);
});

test("bus assignment update and delete routes are wired",()=>{
  const routes=read("src/routes/workspaces/operationalTrips.js");
  assert.match(routes,/bus-assignments\/:assignmentId/);
  assert.match(routes,/updateBusAssignment/);
  assert.match(routes,/deleteBusAssignment/);
});
