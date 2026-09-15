// Pure, write-free planner for moving legacy v4 Trip data into the canonical
// operational schema. It deliberately treats Trip.buses JSON as migration input
// only; the destination is normalized TripBusAssignment rows.

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

export function planLegacyBusAssignments(trip) {
  if (!Array.isArray(trip?.buses)) return [];
  return trip.buses.map((bus, index) => ({
    legacyTripId: trip.id,
    sequence: index + 1,
    busType: text(bus?.busType),
    seatCapacity: nonNegativeInt(bus?.busSeats ?? bus?.seatCapacity),
    vehicleNumber: text(bus?.vehicleNumber),
    plateNumber: text(bus?.plateNumber),
    driverName: text(bus?.driverName),
    driverPhone: text(bus?.driverPhone),
    price: money(bus?.tripPrice ?? bus?.price),
    currency: text(bus?.currency)?.toUpperCase() || "AED",
    status: normalizeStatus(bus?.status),
    notes: text(bus?.notes),
  }));
}

export function planOperationalTrip(trip, context = {}) {
  if (!Number.isInteger(Number(trip?.id))) throw new TypeError("legacy trip id is required");
  const owningSchoolOrganizationId = text(context.owningSchoolOrganizationId ?? trip.owningSchoolOrganizationId);
  if (!owningSchoolOrganizationId) {
    const error = new Error(`Trip ${trip.id} has no resolved owning school organization`);
    error.code = "OPERATIONAL_MIGRATION_MISSING_SCHOOL";
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
      // Compatibility snapshots are retained during migration only. New code
      // reads normalized assignments instead of deriving buses from this JSON.
      buses: Array.isArray(trip.buses) ? trip.buses : null,
      busInfo: trip.busInfo ?? null, driverInfo: trip.driverInfo ?? null,
    },
    busAssignments: planLegacyBusAssignments(trip),
  };
}

export function buildOperationalMigrationPlan(trips, resolveContext) {
  if (!Array.isArray(trips)) throw new TypeError("trips must be an array");
  if (typeof resolveContext !== "function") throw new TypeError("resolveContext is required");
  const rows = [];
  const errors = [];
  for (const trip of trips) {
    try { rows.push(planOperationalTrip(trip, resolveContext(trip) || {})); }
    catch (error) { errors.push({ legacyTripId: trip?.id ?? null, code: error?.code || "OPERATIONAL_MIGRATION_INVALID_TRIP" }); }
  }
  return { mode: "READ_ONLY_OPERATIONAL_MIGRATION_PLAN", writesPerformed: false, rows, errors,
    counts: { sourceTrips: trips.length, plannedTrips: rows.length, busAssignments: rows.reduce((sum, row) => sum + row.busAssignments.length, 0), errors: errors.length } };
}
