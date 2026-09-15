// Pure, write-free planner for moving legacy v4 Trip data into the canonical
// operational schema. Trip.buses JSON and historical SubTrip rows are migration
// inputs only; the destination is one Trip with normalized TripBusAssignments.

function text(value) {
  const result = String(value ?? "").trim();
  return result || null;
}

function nonNegativeInt(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

function money(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n.toFixed(2) : null;
}

function normalizeStatus(value, fallback = "assigned") {
  return text(value)?.toLowerCase() || fallback;
}

function assignmentShape(source) {
  return {
    busType: text(source?.busType),
    seatCapacity: nonNegativeInt(source?.busSeats ?? source?.seatCapacity),
    vehicleNumber: text(source?.vehicleNumber),
    plateNumber: text(source?.plateNumber),
    driverName: text(source?.driverName),
    driverPhone: text(source?.driverPhone),
    price: money(source?.tripPrice ?? source?.price),
    currency: text(source?.currency)?.toUpperCase() || "AED",
    status: normalizeStatus(source?.status),
    notes: text(source?.notes),
  };
}

function fingerprint(row) {
  return JSON.stringify(assignmentShape(row));
}

export function planLegacyBusAssignments(trip) {
  if (!Array.isArray(trip?.buses)) return [];
  return trip.buses.map((bus, index) => ({ legacyTripId: trip.id, sequence: index + 1, ...assignmentShape(bus) }));
}

// Reconcile the two historical bus representations without guessing. Exact
// duplicates are collapsed. Distinct SubTrip rows are appended as assignments.
// If a SubTrip partially resembles a JSON bus but disagrees on populated fields,
// the trip is flagged for review rather than silently duplicating/overwriting it.
export function reconcileLegacyBusAssignments(trip, subTrips = []) {
  const jsonRows = Array.isArray(trip?.buses) ? trip.buses : [];
  const legacySubTrips = Array.isArray(subTrips) ? subTrips.filter((row) => Number(row?.parentTripId) === Number(trip?.id)) : [];
  const assignments = jsonRows.map((row) => assignmentShape(row));
  const warnings = [];
  const conflicts = [];

  for (const subTrip of legacySubTrips) {
    const candidate = assignmentShape(subTrip);
    if (assignments.some((row) => fingerprint(row) === fingerprint(candidate))) {
      warnings.push({ code: "LEGACY_BUS_DUPLICATE_COLLAPSED", legacySubTripId: subTrip.id ?? null });
      continue;
    }

    const populated = Object.entries(candidate).filter(([key, value]) => !["currency", "status"].includes(key) && value !== null);
    const conflictingIndex = assignments.findIndex((row) => {
      const comparable = populated.filter(([key]) => row[key] !== null);
      if (!comparable.length) return false;
      const agrees = comparable.filter(([key, value]) => row[key] === value).length;
      const disagrees = comparable.filter(([key, value]) => row[key] !== value).length;
      return agrees > 0 && disagrees > 0;
    });
    if (conflictingIndex >= 0) {
      conflicts.push({ code: "LEGACY_BUS_SOURCE_CONFLICT", legacySubTripId: subTrip.id ?? null, jsonBusSequence: conflictingIndex + 1 });
      continue;
    }
    assignments.push(candidate);
  }

  return {
    assignments: assignments.map((row, index) => ({ legacyTripId: trip.id, sequence: index + 1, ...row })),
    warnings,
    conflicts,
  };
}

export function planOperationalTrip(trip, context = {}) {
  if (!Number.isInteger(Number(trip?.id))) throw new TypeError("legacy trip id is required");
  const owningSchoolOrganizationId = text(context.owningSchoolOrganizationId ?? trip.owningSchoolOrganizationId);
  if (!owningSchoolOrganizationId) {
    const error = new Error(`Trip ${trip.id} has no resolved owning school organization`);
    error.code = "OPERATIONAL_MIGRATION_MISSING_SCHOOL";
    throw error;
  }
  const reconciliation = reconcileLegacyBusAssignments(trip, context.subTrips ?? trip.subTripDocs ?? []);
  if (reconciliation.conflicts.length) {
    const error = new Error(`Trip ${trip.id} has conflicting legacy bus sources`);
    error.code = "OPERATIONAL_MIGRATION_BUS_SOURCE_CONFLICT";
    error.conflicts = reconciliation.conflicts;
    throw error;
  }

  return {
    trip: {
      id: Number(trip.id),
      createdAt: trip.createdAt || undefined,
      createdByAppUserId: text(context.createdByAppUserId ?? trip.createdByAppUserId),
      tenantId: text(context.tenantId ?? trip.tenantId),
      owningSchoolOrganizationId,
      managingOrganizationId: text(context.managingOrganizationId ?? trip.managingOrganizationId),
      transportProviderOrganizationId: text(context.transportProviderOrganizationId ?? trip.transportProviderOrganizationId),
      createdBy: text(trip.createdBy),
      createdByEmail: text(trip.createdByEmail),
      createdById: Number.isInteger(Number(trip.createdById)) ? Number(trip.createdById) : null,
      origin: text(trip.origin), tripType: text(trip.tripType), destination: text(trip.destination),
      date: trip.date || null, departureTime: text(trip.departureTime), returnDate: trip.returnDate || null,
      returnTime: text(trip.returnTime), students: nonNegativeInt(trip.students), staff: nonNegativeInt(trip.staff),
      status: text(trip.status), price: trip.price == null ? null : Number(trip.price), notes: text(trip.notes),
      boosterSeatsRequested: Boolean(trip.boosterSeatsRequested), boosterSeatCount: nonNegativeInt(trip.boosterSeatCount) || 0,
      cancelRequest: Boolean(trip.cancelRequest),
      buses: Array.isArray(trip.buses) ? trip.buses : null,
      busInfo: trip.busInfo ?? null, driverInfo: trip.driverInfo ?? null,
    },
    busAssignments: reconciliation.assignments,
    migrationWarnings: reconciliation.warnings,
  };
}

export function buildOperationalMigrationPlan(trips, resolveContext) {
  if (!Array.isArray(trips)) throw new TypeError("trips must be an array");
  if (typeof resolveContext !== "function") throw new TypeError("resolveContext is required");
  const rows = [];
  const errors = [];
  const warnings = [];
  for (const trip of trips) {
    try {
      const row = planOperationalTrip(trip, resolveContext(trip) || {});
      rows.push(row);
      for (const warning of row.migrationWarnings || []) warnings.push({ legacyTripId: trip.id, ...warning });
    } catch (error) {
      errors.push({ legacyTripId: trip?.id ?? null, code: error?.code || "OPERATIONAL_MIGRATION_INVALID_TRIP", conflicts: error?.conflicts });
    }
  }
  return {
    mode: "READ_ONLY_OPERATIONAL_MIGRATION_PLAN", writesPerformed: false, rows, errors, warnings,
    counts: {
      sourceTrips: trips.length, plannedTrips: rows.length,
      busAssignments: rows.reduce((sum, row) => sum + row.busAssignments.length, 0),
      warnings: warnings.length, errors: errors.length,
    },
  };
}
