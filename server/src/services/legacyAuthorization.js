// server/src/services/legacyAuthorization.js
// Transitional policy layer for the existing v4 data model.
//
// This is intentionally separate from route handlers so the legacy single-role
// model can be replaced later by AppUser + memberships + scoped permissions
// without rewriting every endpoint again.

const creatorMatches = (user, resource) => {
  if (!user || !resource) return false;
  if (resource.createdById != null && Number(resource.createdById) === Number(user.id)) {
    return true;
  }
  return Boolean(
    user.email &&
      resource.createdByEmail &&
      String(user.email).toLowerCase() === String(resource.createdByEmail).toLowerCase()
  );
};

export function isAdmin(user) {
  return user?.role === "admin";
}

export function canReadTrip(user, trip) {
  if (!user || !trip) return false;
  if (isAdmin(user)) return true;

  // Preserve v4's broad read behaviour for non-school operational roles until
  // organization relationships are migrated and can replace this compatibility rule.
  if (["bus_operator", "finance", "trip_manager"].includes(user.role)) return true;

  if (user.role === "school_staff") return creatorMatches(user, trip);
  return false;
}

export function canCreateTrip(user) {
  return Boolean(user && ["school_staff", "trip_manager", "admin"].includes(user.role));
}

export function canDeleteTrip(user) {
  return isAdmin(user);
}

const STAFF_EDITABLE_FIELDS = new Set([
  "tripType",
  "destination",
  "origin",
  "date",
  "departureTime",
  "returnDate",
  "returnTime",
  "students",
  "staff",
  "notes",
  "boosterSeatsRequested",
  "boosterSeatCount",
]);

const OPERATOR_EDITABLE_FIELDS = new Set([
  "status",
  "price",
  "busInfo",
  "driverInfo",
  "buses",
  "cancelRequest",
]);

const FINANCE_EDITABLE_FIELDS = new Set(["price"]);

function fieldsAreWithin(fields, allowed) {
  return fields.every((field) => allowed.has(field));
}

function statusTransitionAllowed(role, currentStatus, nextStatus) {
  if (role === "admin") return true;
  if (!nextStatus || nextStatus === currentStatus) return true;

  if (role === "school_staff") {
    return (
      (currentStatus === "Pending" && nextStatus === "Canceled") ||
      (["Accepted", "Confirmed"].includes(currentStatus) && nextStatus === "Cancel Requested")
    );
  }

  if (role === "bus_operator") {
    return (
      (currentStatus === "Pending" && ["Accepted", "Rejected"].includes(nextStatus)) ||
      (currentStatus === "Accepted" && ["Confirmed", "Canceled"].includes(nextStatus)) ||
      (currentStatus === "Confirmed" && ["Completed", "Canceled"].includes(nextStatus)) ||
      (currentStatus === "Cancel Requested" && ["Canceled", "Confirmed"].includes(nextStatus))
    );
  }

  return false;
}

export function canUpdateTrip(user, trip, patch) {
  if (!user || !trip || !patch) return false;
  if (isAdmin(user)) return true;

  const fields = Object.keys(patch);

  if (user.role === "school_staff") {
    if (!creatorMatches(user, trip)) return false;

    const allowedFields = new Set(STAFF_EDITABLE_FIELDS);
    allowedFields.add("status");
    allowedFields.add("cancelRequest");

    if (!fieldsAreWithin(fields, allowedFields)) return false;
    if (!["Pending", "Accepted", "Confirmed"].includes(trip.status)) return false;
    return statusTransitionAllowed(user.role, trip.status, patch.status);
  }

  if (user.role === "bus_operator") {
    if (!fieldsAreWithin(fields, OPERATOR_EDITABLE_FIELDS)) return false;
    return statusTransitionAllowed(user.role, trip.status, patch.status);
  }

  if (user.role === "finance") {
    return fieldsAreWithin(fields, FINANCE_EDITABLE_FIELDS);
  }

  // The old trip_manager role existed in navigation but did not have a reliable
  // trip-action matrix. Keep it read/create-only until its intended permissions
  // are explicitly migrated.
  return false;
}

export function canReadPassengers(user, trip) {
  if (!user || !trip) return false;
  if (isAdmin(user)) return true;
  return user.role === "school_staff" && creatorMatches(user, trip);
}

export function canManagePassengers(user, trip) {
  return Boolean(user?.role === "school_staff" && creatorMatches(user, trip));
}

export function canReadSubTrips(user, trip) {
  return canReadTrip(user, trip);
}

export function canManageSubTrips(user, trip) {
  if (!user || !trip) return false;
  return isAdmin(user) || user.role === "bus_operator";
}

export function canReadBooking(user, booking) {
  if (!user || !booking) return false;
  if (isAdmin(user) || user.role === "trip_manager") return true;
  return user.role === "school_staff" && creatorMatches(user, booking);
}

export function canCreateBooking(user) {
  return Boolean(user && ["school_staff", "trip_manager", "admin"].includes(user.role));
}

export function canUpdateBooking(user, booking) {
  if (!user || !booking) return false;
  if (isAdmin(user) || user.role === "trip_manager") return true;
  return user.role === "school_staff" && creatorMatches(user, booking);
}

export function canDeleteBooking(user, booking) {
  return canUpdateBooking(user, booking);
}

export function creatorWhere(user) {
  return {
    OR: [
      { createdById: Number(user.id) },
      ...(user.email ? [{ createdByEmail: user.email }] : []),
    ],
  };
}
