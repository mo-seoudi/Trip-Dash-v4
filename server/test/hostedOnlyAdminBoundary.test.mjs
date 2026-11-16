import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/routes/dataSourceAdminRoutes.js", import.meta.url), "utf8");

test("hosted-only admin operations omit credential joins", () => {
  assert.match(source, /const sourceInclude=\(\)=>process\.env\.OPERATIONAL_HOSTED_ONLY==="true"\?\{\}:\{include:includeCredential\}/);
  assert.match(source, /findFirst\(\{where:\{organizationId:schoolId,mode:requestedMode\},\.\.\.sourceInclude\(\)\}\)/);
  assert.match(source, /findUnique\(\{where:\{id:dataSource\.id\},\.\.\.sourceInclude\(\)\}\)/);
  assert.match(source, /findUnique\(\{where:\{id\},\.\.\.sourceInclude\(\)\}\)/);
});

test("external mode is rejected by the admin boundary when hosted-only", () => {
  assert.match(source, /OPERATIONAL_HOSTED_ONLY==="true"&&result!=="HOSTED"/);
  assert.match(source, /OPERATIONAL_HOSTED_ONLY==="true"&&existing\.mode!=="HOSTED"/);
});
