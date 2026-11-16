import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const authorized = fs.readFileSync(new URL("../src/services/authorizedOperationalContext.js", import.meta.url), "utf8");
const workspace = fs.readFileSync(new URL("../src/services/workspaceOperationalContext.js", import.meta.url), "utf8");

test("authenticated operational context uses canonical runtime access boundary", () => {
  assert.match(authorized, /import\s*\{\s*resolveRuntimeAccess\s*\}\s*from\s*["']\.\/accessRuntime\.js["']/);
  assert.match(authorized, /resolveRuntimeAccess\(\{\s*user:\s*identity\s*\}\)/);
  assert.doesNotMatch(authorized, /resolveEffectiveAccess/);
});

test("external workspace routing uses canonical datasource resolver without a second query", () => {
  const external = workspace.split("export async function operationalPrismaForExternalWorkspace")[1];
  assert.ok(external);
  assert.match(external, /getOperationalContextForOrganization\(id\)/);
  assert.doesNotMatch(external, /operationalDataSource\.findMany/);
});
