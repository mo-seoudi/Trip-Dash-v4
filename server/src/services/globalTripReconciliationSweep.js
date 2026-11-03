// Durable reconciliation scans operational rows, rather than relying on
// in-memory promises. Each scan can be restarted after a process crash.
// Requires both reviewed migrations; never run on an unmigrated database.
import { prismaControl } from "../lib/prismaControl.js";
import { getOperationalContextForOrganization } from "./operationalPrismaFactory.js";
import { reconcileGlobalTrip } from "./globalTripRegistryService.js";

export async function reconcileSchoolTripBatch({
  schoolId, cursor = 0, limit = 100,
  control = prismaControl,
  getContext = getOperationalContextForOrganization,
  reconcile = reconcileGlobalTrip,
}) {
  if (!Number.isSafeInteger(cursor) || cursor < 0) throw new Error("Invalid cursor");
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) throw new Error("Invalid batch limit");
  const { prisma, dataSource } = await getContext(schoolId);
  const trips = await prisma.trip.findMany({
    where: { owningSchoolOrganizationId: schoolId, id: { gt: cursor } },
    orderBy: { id: "asc" },
    take: limit,
    select: { id: true, globalTripId: true },
  });
  const failed = [];
  let registered = 0;
  for (const trip of trips) {
    try {
      await reconcile({ schoolId, localTripId: trip.id, control, getContext });
      registered++;
    } catch (error) {
      failed.push({ tripId: trip.id, code: error.code || "RECONCILIATION_FAILED" });
    }
  }
  return {
    schoolId, dataSourceId: dataSource.id,
    nextCursor: trips.at(-1)?.id ?? cursor,
    hasMore: trips.length === limit,
    scanned: trips.length, registered, failed,
  };
}

// A complete sweep revisits every trip, including records that already have a
// UUID but whose control-plane upsert failed. The caller must persist the
// cursor/checkpoint externally and rerun failed IDs or restart from zero.
// No data is deleted or reassigned by this scanner.
export async function reconcileSchoolTripSweep({ schoolId, maxBatches = 100, ...deps }) {
  if (!Number.isSafeInteger(maxBatches) || maxBatches < 1) throw new Error("Invalid maxBatches");
  let cursor = 0;
  const summary = { scanned: 0, registered: 0, failed: [] };
  for (let i = 0; i < maxBatches; i++) {
    const batch = await reconcileSchoolTripBatch({ schoolId, cursor, ...deps });
    summary.scanned += batch.scanned;
    summary.registered += batch.registered;
    summary.failed.push(...batch.failed);
    cursor = batch.nextCursor;
    if (!batch.hasMore) return { ...summary, complete: true, nextCursor: cursor };
  }
  return { ...summary, complete: false, nextCursor: cursor };
}
