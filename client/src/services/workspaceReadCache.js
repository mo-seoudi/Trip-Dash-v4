// Short-lived, per-workspace in-memory cache for navigation between screens.
// No persistence: data is cleared on authentication changes and mutation responses.
const TTL_MS = 30_000;
const entries = new Map();
const pending = new Map();
const keyFor = (kind, schoolId) => `${kind}:${String(schoolId || "")}`;
export function clearWorkspaceReadCache() { entries.clear(); pending.clear(); }
export function invalidateWorkspaceReadCache(schoolId) {
  const suffix = `:${String(schoolId || "")}`;
  for (const key of entries.keys()) if (key.endsWith(suffix)) entries.delete(key);
  for (const key of pending.keys()) if (key.endsWith(suffix)) pending.delete(key);
}
export async function cachedWorkspaceRead(kind, schoolId, loader, { force = false } = {}) {
  const key = keyFor(kind, schoolId);
  if (force) entries.delete(key);
  const current = entries.get(key);
  if (!force && current && Date.now() < current.expiresAt) return current.value;
  if (pending.has(key)) return pending.get(key);
  const request = Promise.resolve().then(loader).then(value => {
    if (pending.get(key) === request) entries.set(key, { value, expiresAt: Date.now() + TTL_MS });
    return value;
  }).finally(() => { if (pending.get(key) === request) pending.delete(key); });
  pending.set(key, request);
  return request;
}
