// Guarded writer for a precomputed legacy-v4 -> canonical operational plan.
// Nothing in runtime routes imports this module. It exists only for controlled
// migration rehearsals and eventual cutover tooling.

function assertWritable(plan, { allowWrite, environment } = {}) {
  if (allowWrite !== true) {
    const error = new Error("Operational migration writes require explicit allowWrite=true");
    error.code = "OPERATIONAL_MIGRATION_WRITE_NOT_ALLOWED";
    throw error;
  }
  if (String(environment || process.env.NODE_ENV || "").toLowerCase() === "production") {
    const error = new Error("Operational migration writer is blocked in production");
    error.code = "OPERATIONAL_MIGRATION_PRODUCTION_BLOCKED";
    throw error;
  }
  if (!plan || plan.writesPerformed !== false || !Array.isArray(plan.rows) || !Array.isArray(plan.errors)) {
    const error = new Error("A valid read-only operational migration plan is required");
    error.code = "OPERATIONAL_MIGRATION_INVALID_PLAN";
    throw error;
  }
  if (plan.errors.length) {
    const error = new Error("Operational migration plan contains unresolved errors");
    error.code = "OPERATIONAL_MIGRATION_PLAN_HAS_ERRORS";
    throw error;
  }
}

function cleanTripData(row) {
  const data = { ...row.trip };
  if (data.createdAt === undefined) delete data.createdAt;
  return data;
}

export async function writeOperationalMigration(prisma, plan, options = {}) {
  if (!prisma?.$transaction) throw new TypeError("Operational Prisma client is required");
  assertWritable(plan, options);

  const result = await prisma.$transaction(async (tx) => {
    let trips = 0;
    let busAssignments = 0;
    for (const row of plan.rows) {
      const trip = await tx.trip.create({ data: cleanTripData(row) });
      trips += 1;
      for (const assignment of row.busAssignments) {
        const { legacyTripId: _legacyTripId, ...data } = assignment;
        await tx.tripBusAssignment.create({ data: { ...data, tripId: trip.id } });
        busAssignments += 1;
      }
    }
    return { trips, busAssignments };
  });

  return {
    mode: "OPERATIONAL_MIGRATION_WRITE",
    writesPerformed: true,
    counts: result,
  };
}
