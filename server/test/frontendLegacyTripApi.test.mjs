import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const clientSrc = path.resolve(here, "../../client/src");
const sourceExtensions = new Set([".js", ".jsx", ".mjs", ".ts", ".tsx"]);

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return sourceExtensions.has(path.extname(entry.name)) ? [full] : [];
  }));
  return nested.flat();
}

function relative(file) {
  return path.relative(clientSrc, file).replaceAll(path.sep, "/");
}

// The browser must use /workspaces/:schoolId/trips. Keeping this guard in CI makes
// the legacy /api/trips retirement gate measurable instead of relying on a manual
// audit that can regress as old v4 components are reused.
test("frontend has no direct calls to the legacy /trips API", async () => {
  const offenders = [];
  for (const file of await sourceFiles(clientSrc)) {
    const text = await readFile(file, "utf8");
    const directLegacyCall = /api\s*\.\s*(?:get|post|put|patch|delete)\s*\(\s*[`'"]\/trips(?:[\/?`'"])/g;
    if (directLegacyCall.test(text)) offenders.push(relative(file));
  }
  assert.deepEqual(offenders, [], `Legacy /trips API calls remain in: ${offenders.join(", ")}`);
});

test("frontend contains no SubTrip API or helper residue", async () => {
  const offenders = [];
  for (const file of await sourceFiles(clientSrc)) {
    const text = await readFile(file, "utf8");
    if (/subtrips|createSubTrips|getSubTripsByParent/i.test(text)) offenders.push(relative(file));
  }
  assert.deepEqual(offenders, [], `Obsolete SubTrip frontend references remain in: ${offenders.join(", ")}`);
});
