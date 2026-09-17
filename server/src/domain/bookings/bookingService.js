function idOf(value) { const id = Number(value); return Number.isInteger(id) && id > 0 ? id : null; }
function num(value, fallback = null) { if (value === "" || value == null) return fallback; const n = Number(value); return Number.isFinite(n) ? n : fallback; }
function date(value) { return value ? new Date(value) : null; }

export class BookingNotFoundError extends Error { constructor() { super("Booking not found"); this.status = 404; this.code = "BOOKING_NOT_FOUND"; } }

export function createBookingService({ prisma, workspace, user }) {
  const schoolId = String(workspace.schoolId);
  const requesterId = String(user?.organizationId || schoolId);
  const actorId = user?.appUserId ? String(user.appUserId) : null;
  const scopedWhere = (id) => ({ id, owningSchoolOrganizationId: schoolId });

  async function get(idValue) {
    const id = idOf(idValue); if (!id) throw new BookingNotFoundError();
    const row = await prisma.busBooking.findFirst({ where: scopedWhere(id) });
    if (!row) throw new BookingNotFoundError();
    return row;
  }

  return {
    list: () => prisma.busBooking.findMany({ where: { owningSchoolOrganizationId: schoolId }, orderBy: { createdAt: "desc" } }),
    get,
    create: (body = {}) => {
      const students = num(body.students, 0), adults = num(body.adults, 0);
      return prisma.busBooking.create({ data: {
        createdByAppUserId: actorId, owningSchoolOrganizationId: schoolId,
        requestingOrganizationId: requesterId, payerOrganizationId: body.payerOrganizationId || requesterId,
        title: body.title ?? null, purpose: body.purpose ?? null, date: date(body.date), startTime: body.startTime ?? null,
        endDate: date(body.endDate), endTime: body.endTime ?? null, durationMinutes: num(body.durationMinutes),
        students, adults, totalPassengers: students + adults,
        pickupPoints: Array.isArray(body.pickupPoints) ? body.pickupPoints : undefined,
        dropoffPoints: Array.isArray(body.dropoffPoints) ? body.dropoffPoints : undefined,
        busesRequested: num(body.busesRequested), busType: body.busType ?? null, notes: body.notes ?? null, status: "requested",
      }});
    },
    update: async (idValue, body = {}) => {
      const existing = await get(idValue); const students = body.students === undefined ? existing.students : num(body.students, 0); const adults = body.adults === undefined ? existing.adults : num(body.adults, 0);
      const data = {};
      for (const key of ["title","purpose","startTime","endTime","busType","notes","status"]) if (body[key] !== undefined) data[key] = body[key];
      if (body.date !== undefined) data.date = date(body.date); if (body.endDate !== undefined) data.endDate = date(body.endDate);
      if (body.durationMinutes !== undefined) data.durationMinutes = num(body.durationMinutes); if (body.busesRequested !== undefined) data.busesRequested = num(body.busesRequested);
      if (body.pickupPoints !== undefined) data.pickupPoints = Array.isArray(body.pickupPoints) ? body.pickupPoints : undefined; if (body.dropoffPoints !== undefined) data.dropoffPoints = Array.isArray(body.dropoffPoints) ? body.dropoffPoints : undefined;
      if (body.students !== undefined || body.adults !== undefined) Object.assign(data, { students, adults, totalPassengers: students + adults });
      return prisma.busBooking.update({ where: { id: existing.id }, data });
    },
    remove: async (idValue) => { const existing = await get(idValue); await prisma.busBooking.delete({ where: { id: existing.id } }); return { ok: true }; },
  };
}
