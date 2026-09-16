import test from "node:test";
import assert from "node:assert/strict";
import { validateInternalQuotationApprover } from "../src/services/quotationApprovalAuthorization.js";

const user = (overrides = {}) => ({ id: "app-1", email: "approver@school.ae", isActive: true, legacyUserId: 101, ...overrides });
const globalPrismaFor = (record) => ({ user: { async findFirst() { return record; } } });
const accessFor = (workspaces) => async () => ({ user: { appUserId: "app-1" }, workspaces });
const ws = (schoolId, permissions) => ({ schoolId, permissions });

test("accepts an active app user with quotation approval permission for the exact school", async () => {
  const result = await validateInternalQuotationApprover({
    appUserId: "app-1", schoolId: "school-a", globalPrisma: globalPrismaFor(user()),
    resolveAccess: accessFor([ws("school-a", ["trip.approve_quote"])])
  });
  assert.equal(result.appUserId, "app-1");
  assert.equal(result.email, "approver@school.ae");
  assert.equal(result.workspace.schoolId, "school-a");
});

test("rejects a user who can approve quotations, but only for another school", async () => {
  await assert.rejects(() => validateInternalQuotationApprover({
    appUserId: "app-1", schoolId: "school-a", globalPrisma: globalPrismaFor(user()),
    resolveAccess: accessFor([ws("school-b", ["trip.approve_quote"])])
  }), (error) => error?.status === 400 && error?.code === "APPROVER_NOT_AUTHORIZED");
});

test("rejects a school member who lacks quotation approval permission", async () => {
  await assert.rejects(() => validateInternalQuotationApprover({
    appUserId: "app-1", schoolId: "school-a", globalPrisma: globalPrismaFor(user()),
    resolveAccess: accessFor([ws("school-a", ["trip.read", "trip.edit"])])
  }), (error) => error?.status === 400 && error?.code === "APPROVER_NOT_AUTHORIZED");
});

test("rejects inactive, missing, or unmapped application users before resolving access", async () => {
  for (const record of [null, user({ isActive: false }), user({ legacyUserId: null })]) {
    let resolved = false;
    await assert.rejects(() => validateInternalQuotationApprover({
      appUserId: "app-1", schoolId: "school-a", globalPrisma: globalPrismaFor(record),
      resolveAccess: async () => { resolved = true; return {}; }
    }), (error) => error?.status === 400 && error?.code === "APPROVER_INVALID");
    assert.equal(resolved, false);
  }
});
