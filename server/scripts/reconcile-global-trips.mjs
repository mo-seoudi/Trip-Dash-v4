// Explicit operator-run reconciliation. Never scheduled or invoked by app startup.
// Usage (after migrations and Prisma validation):
// GLOBAL_TRIP_RECONCILIATION_ENABLED=true node scripts/reconcile-global-trips.mjs <school-uuid> [cursor] [limit]
// Resume with nextCursor, or restart from 0 to retry previously failed IDs.
import "dotenv/config";
import { prismaControl } from "../src/lib/prismaControl.js";
import { disconnectAllOperationalClients } from "../src/services/operationalPrismaFactory.js";
import { reconcileSchoolTripBatch } from "../src/services/globalTripReconciliationSweep.js";

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const schoolId=process.argv[2];
const cursor=Number(process.argv[3]??0);
const limit=Number(process.argv[4]??100);
if(process.env.GLOBAL_TRIP_RECONCILIATION_ENABLED!=="true") {
  console.error("Refusing to run: GLOBAL_TRIP_RECONCILIATION_ENABLED must be true");
  process.exitCode=2;
} else if(!uuid.test(schoolId||"")||!Number.isSafeInteger(cursor)||cursor<0||!Number.isSafeInteger(limit)||limit<1||limit>500) {
  console.error("Usage: reconcile-global-trips.mjs <school-uuid> [cursor >= 0] [limit 1..500]");
  process.exitCode=2;
} else {
  try {
    const result=await reconcileSchoolTripBatch({schoolId,cursor,limit});
    console.log(JSON.stringify(result));
    if(result.failed.length)process.exitCode=1;
  } catch(error) {
    console.error("Reconciliation failed:",error.code||error.name||"UNKNOWN");
    process.exitCode=1;
  } finally {
    await Promise.allSettled([prismaControl.$disconnect(),disconnectAllOperationalClients()]);
  }
}
