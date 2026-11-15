// Shared, short-lived directory read cache. No persistent storage.
// Deduplicates simultaneous navigation requests; explicit mutations invalidate it.
import api from "./apiClient";
const TTL_MS = 30_000;
let cached = null;
let pending = null;
let generation = 0;
export function invalidatePlatformDirectory() {
  generation += 1;
  cached = null;
  pending = null;
}
export function getPlatformDirectory({ force = false } = {}) {
  if (force) invalidatePlatformDirectory();
  if (cached && Date.now() < cached.expiresAt) return Promise.resolve({ data: cached.data });
  if (pending) return pending;
  const startedGeneration = generation;
  const request = api.get("/platform-control/directory").then(response => {
    if (generation === startedGeneration) cached = { data: response.data, expiresAt: Date.now() + TTL_MS };
    return response;
  }).finally(() => {
    if (pending === request) pending = null;
  });
  pending = request;
  return request;
}
