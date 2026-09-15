// Read-only verification of a completed operational migration rehearsal.
// Verification is deliberately based on the precomputed plan: the destination
// must contain exactly the planned Trips and normalized Bus Assignments.

function decimal(value) {
  if (value === null || value === undefined) return null;
  return Number(value).toFixed(2);
}

function comparableAssignment(row) {
  return {
    sequence: row.sequence,
    busType: row.busType ?? null,
    seatCapacity: row.seatCapacity ?? null,
    vehicleNumber: row.vehicleNumber ?? null,
    plateNumber: row.plateNumber ?? null,
    driverName: row.driverName ?? null,
    driverPhone: row.driverPhone ?? null,
    price: decimal(row.price),
    currency: row.currency,
    status: row.status,
    notes: row.notes ?? null,
  };
}

export async function verifyOperationalMigration(prisma, plan) {
  if (!prisma?.trip?.findMany) throw new TypeError("Operational Prisma client is required");
  if (!plan || !Array.isArray(plan.rows)) throw new TypeError("Operational migration plan is required");

  const ids = plan.rows.map((row) => row.trip.id);
  const stored = ids.length ? await prisma.trip.findMany({
    where: { id: { in: ids } },
    include: { busAssignments: { orderBy: { sequence: "asc" } } },
    orderBy: { id: "asc" },
  }) : [];
  const byId = new Map(stored.map((trip) => [trip.id, trip]));
  const issues = [];

  for (const row of plan.rows) {
    const trip = byId.get(row.trip.id);
    if (!trip) { issues.push({ code: "MISSING_TRIP", legacyTripId: row.trip.id }); continue; }
    if (trip.owningSchoolOrganizationId !== row.trip.owningSchoolOrganizationId) issues.push({ code: "SCHOOL_MISMATCH", legacyTripId: row.trip.id });
    if (trip.busAssignments.length !== row.busAssignments.length) issues.push({ code: "BUS_ASSIGNMENT_COUNT_MISMATCH", legacyTripId: row.trip.id, expected: row.busAssignments.length, actual: trip.busAssignments.length });
    const expected = row.busAssignments.map(({ legacyTripId: _legacyTripId, ...assignment }) => comparableAssignment(assignment));
    const actual = trip.busAssignments.map(comparableAssignment);
    if (JSON.stringify(actual) !== JSON.stringify(expected)) issues.push({ code: "BUS_ASSIGNMENT_DATA_MISMATCH", legacyTripId: row.trip.id });
  }

  return { exact: issues.length === 0, issues, counts: { plannedTrips: plan.rows.length, storedTrips: stored.length, issues: issues.length } };
}

export async function assertOperationalMigrationVerified(prisma, plan) {
  const result = await verifyOperationalMigration(prisma, plan);
  if (!result.exact) {
    const error = new Error("Operational migration verification failed");
    error.code = "OPERATIONAL_MIGRATION_VERIFICATION_FAILED";
    error.verification = result;
    throw error;
  }
  return result;
}
