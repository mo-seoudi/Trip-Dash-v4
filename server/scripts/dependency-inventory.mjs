// Read-only dependency inventory. Run: node scripts/dependency-inventory.mjs
// Conservative static analysis: dynamic imports, runtime registration and external API
// consumers require manual review. Never use the candidate list as a deletion list.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(serverRoot, "..");
const extensions = [".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"];
function files(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? files(path.join(dir, e.name)) : extensions.some(x => e.name.endsWith(x)) ? [path.join(dir, e.name)] : []);
}
function rel(file) { return path.relative(repoRoot, file).replaceAll(path.sep, "/"); }
const source = [...files(path.join(serverRoot, "src")), ...files(path.join(repoRoot, "client", "src"))].sort();
const testFiles = files(path.join(serverRoot, "test"));
const scripts = files(path.join(serverRoot, "scripts"));
const all = [...new Set([...source, ...testFiles, ...scripts])];
const content = new Map(all.map(p => [p, fs.readFileSync(p, "utf8")]));
const importRE = /(?:\bimport\s+(?:[^;\n]*?\s+from\s*)?|\bexport\s+(?:\*|\{[^}]*\})\s*from\s*|\brequire\s*\(|\bimport\s*\()\s*["'](\.[^"']+)["']/g;
function resolveImport(origin, spec) {
  const base = path.resolve(path.dirname(origin), spec);
  return [base, ...extensions.map(e => base + e), ...extensions.map(e => path.join(base, "index" + e))].find(x => content.has(x)) || null;
}
const edges = [];
const unresolved = [];
for (const [file, code] of content) {
  for (const match of code.matchAll(importRE)) {
    const dest = resolveImport(file, match[1]);
    if (dest) edges.push([rel(file), rel(dest)]);
    else unresolved.push({ from: rel(file), import: match[1] });
  }
}
const roots = [path.join(serverRoot, "src", "index.js"), path.join(repoRoot, "client", "src", "main.jsx")].filter(p => content.has(p)).map(rel);
const graph = new Map();
for (const [a,b] of edges) graph.set(a, [...(graph.get(a) || []), b]);
const reachable = new Set(roots);
const queue = [...roots];
while (queue.length) {
  for (const next of graph.get(queue.shift()) || []) if (!reachable.has(next)) { reachable.add(next); queue.push(next); }
}
const incoming = new Map();
for (const [a,b] of edges) incoming.set(b, [...(incoming.get(b) || []), a]);
const candidateModules = source.map(rel).filter(p => !reachable.has(p));
const schemaModels = {};
for (const [label, schema] of Object.entries({control:"control.schema.prisma", operational:"operational.schema.prisma"})) {
  const body = fs.readFileSync(path.join(serverRoot, "prisma", schema), "utf8");
  schemaModels[label] = [...body.matchAll(/^model\s+(\w+)\s*\{/gm)].map(x => {
    const name = x[1], clientName = name[0].toLowerCase() + name.slice(1);
    const matches = source.filter(p => new RegExp("\\b" + clientName + "\\b").test(content.get(p))).map(rel);
    return { name, clientName, sourceReferences: matches, status: matches.length ? "referenced" : "requires-manual-review" };
  });
}
const apiPatterns = [/\b(?:apiClient|fetch|axios)\s*\(/g, /["'`]\/api\//g, /\b(?:get|post|put|patch|delete)\s*\(/g];
const frontendApiHints = source.filter(p => rel(p).startsWith("client/")).flatMap(p => {
  const code = content.get(p);
  const count = apiPatterns.reduce((sum, re) => sum + [...code.matchAll(re)].length, 0);
  return count ? [{file:rel(p),staticApiHints:count}] : [];
});
const routeMounts = [...(content.get(path.join(serverRoot,"src","index.js")) || "").matchAll(/app\.use\(\s*["']([^"']+)["']\s*,\s*(\w+)/g)].map(m=>({path:m[1],moduleSymbol:m[2]}));
const report = {
  warning:"Static candidates are NOT safe to delete. Review dynamic imports, external integrations, database dependencies and tests.",
  roots, counts:{sourceFiles:source.length, testFiles:testFiles.length, scriptFiles:scripts.length, importEdges:edges.length, unreachableSourceCandidates:candidateModules.length},
  routeMounts, candidates:candidateModules.map(p=>({file:p,referencedBy:incoming.get(p)||[],classification:"review-only"})),
  unresolvedRelativeImports:unresolved, prismaModels:schemaModels, frontendApiHints
};
process.stdout.write(JSON.stringify(report,null,2)+"\n");
