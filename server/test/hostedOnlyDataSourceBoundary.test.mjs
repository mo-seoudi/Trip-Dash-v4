import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const resolver = fs.readFileSync(new URL("../src/services/operationalDataSourceResolver.js", import.meta.url), "utf8");

test("hosted-only resolution is opt-in and omits credential joins", () => {
  assert.match(resolver, /process\.env\.OPERATIONAL_HOSTED_ONLY === "true"/);
  assert.match(resolver, /hostedOnly \? \{ select:/);
  assert.match(resolver, /: \{ include: \{ credential:/);
});

test("hosted-only resolution fails closed on external mode", () => {
  assert.match(resolver, /hostedOnly && dataSource\.mode !== "HOSTED"/);
  assert.match(resolver, /DATASOURCE_MODE_UNSUPPORTED/);
  assert.match(resolver, /connectionUrl = hostedConnectionUrl\(\)/);
});

test("existing ambiguous datasource and unsupported engine guards remain", () => {
  assert.match(resolver, /DATASOURCE_AMBIGUOUS/);
  assert.match(resolver, /DATASOURCE_ENGINE_UNSUPPORTED/);
});
