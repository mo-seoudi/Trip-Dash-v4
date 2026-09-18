import test from "node:test";
import assert from "node:assert/strict";
import { validateInternalQuotationApprover } from "../src/services/quotationApprovalAuthorization.js";

const user = (overrides = {}) => ({ id: "app-1", email: "approver@school.ae", displayName: "Approver", status: "active", ...overrides });
const controlPrismaFor = (record) => ({ appUser: { async findFirst() { return record; } } });
const accessFor = (workspaces) => async () => ({ user: { appUserId: "app-1" }, workspaces });
const ws = (schoolId, permissions) => ({ schoolId, permissions });

test("accepts an active canonical app user with quotation approval permission for the exact school", async () => {
  const result = await validateInternalQuotationApprover({
    appUserId: "app-1", schoolId: "school-a", controlPrisma: controlPrismaFor(user()),
    resolveAccess: accessFor([ws("school-a", ["trip.approve_quote"])])
  });
  assert.equal(result.appUserId, "app-1");
  assert.equal(result.email, "approver@school.ae");
  assert.equal(result.fullName, "Approver");
  assert.equal(result.workspace.schoolId, "school-a");
});

test("rejects a user who can approve quotations, but only for another school", async () => {
  await assert.rejects(() => validateInternalQuotationApprover({
    appUserId: "app-1", schoolId: "school-a", controlPrisma: controlPrismaFor(user()),
    resolveAccess: accessFor([ws("school-b", ["trip.approve_quote"])])
  }), (error) => error?.status === 400 && error?.code === "APPROVER_NOT_AUTHORIZED");
});

test("rejects a school member who lacks quotation approval permission", async () => {
  await assert.rejects(() => validateInternalQuotationApprover({
    appUserId: "app-1", schoolId: "school-a", controlPrisma: controlPrismaFor(user()),
    resolveAccess: accessFor([ws("school-a", ["trip.read", "trip.edit"])])
  }), (error) => error?.status === 400 && error?.code === "APPROVER_NOT_AUTHORIZED");
});

test("canonical approval does not require tenant or legacy user context", async () => {
  const result = await validateInternalQuotationApprover({
    appUserId: "app-1", schoolId: "school-a", controlPrisma: controlPrismaFor(user()),
    resolveAccess: accessFor([ws("school-a", ["trip.approve_quote"])])
  });
  assert.equal(result.workspace.schoolId, "school-a");
});

test("rejects inactive or missing canonical application users before resolving access", async () => {
  for (const record of [null, user({ status: "suspended" })]) {
    let resolved = false;
    await assert.rejects(() => validateInternalQuotationApprover({
      appUserId: "app-1", schoolId: "school-a", controlPrisma: controlPrismaFor(record),
      resolveAccess: async () => { resolved = true; return {}; }
    }), (error) => error?.status === 400 && error?.code === "APPROVER_INVALID");
    assert.equal(resolved, false);
  }
});
