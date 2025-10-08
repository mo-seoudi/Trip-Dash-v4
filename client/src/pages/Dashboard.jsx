// src/pages/Dashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { useAuth } from "../context/AuthContext";
import api from "../services/apiClient";
import AdminUsers from "./AdminUsers";
import RequestTripButton from "../components/RequestTripButton";
import StatusBadge from "../components/StatusBadge";
import ModalWrapper from "../components/ModalWrapper";
import TripDetails from "../components/TripDetails";

// Small UI helpers
const Card = ({ title, value, sub }) => (
  <div className="rounded-2xl bg-white shadow-sm p-5 border border-gray-100">
    <p className="text-sm text-gray-500">{title}</p>
    <p className="text-3xl font-semibold mt-1">{value}</p>
    {sub ? <p className="text-xs text-gray-400 mt-1">{sub}</p> : null}
  </div>
);

const Section = ({ title, children }) => (
  <div className="mb-8">
    <h3 className="text-lg font-semibold mb-3">{title}</h3>
    <div className="rounded-2xl bg-white shadow-sm p-5 border border-gray-100">
      {children}
    </div>
  </div>
);

const MAX_UPCOMING = 10;

const Dashboard = () => {
  const { profile } = useAuth();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [isEditing] = useState(false);

  // TripDetails modal
  const [selectedTrip, setSelectedTrip] = useState(null);

  // ---- normalization helpers (non-destructive) ----
  const normalizeStatus = (rawStatus) => {
    const raw = (rawStatus || "").toString().toLowerCase();
    if (["pending", "requested", "awaiting_approval"].includes(raw)) return "pending";
    if (["approved", "confirmed", "accepted"].includes(raw)) return "approved";
    if (["completed", "done", "finished"].includes(raw)) return "completed";
    if (["cancelled", "canceled"].includes(raw)) return "cancelled";
    if (["rejected"].includes(raw)) return "rejected";
    return "unknown";
  };

  const normalizeTrip = (t) => {
    // Keep original fields; add normalized/cache fields prefixed with _
    const statusRaw = t?.status ?? t?.tripStatus ?? t?.state ?? "";
    const statusNorm = normalizeStatus(statusRaw);

    // Only date-like candidates for the date field (do not inject time-only fields)
    const dateField =
      t?.date || t?.tripDate || t?.startDate || t?.createdAt || null;

    // Time-like candidates for time field
    const timeField = t?.departureTime || t?.time || null;

    const isCanceledOrRejected = ["cancelled", "rejected"].includes(statusNorm);

    return {
      ...t,
      _status: statusNorm,
      _date: dateField,
      _time: timeField,
      _isCanceledOrRejected: isCanceledOrRejected,
    };
  };

  // ---- tolerant helpers for slightly different trip shapes ----
  // Keep the original helpers but route through normalized fields when present.
  const getDate = (t) =>
    t?._date ??
    t?.date ??
    t?.tripDate ??
    t?.startDate ??
    t?.departureTime /* legacy, but we no longer rely on this for date */ ??
    t?.createdAt ??
    null;

  const getTime = (t) => t?._time ?? t?.departureTime ?? t?.time ?? null;

  const getStatus = (t) => t?._status ?? normalizeStatus(t?.status || t?.tripStatus || t?.state || "");

  const isCancelledOrRejected = (t) => t?._isCanceledOrRejected ?? ["cancelled", "rejected"].includes(getStatus(t));

  // ---- single, canonical fetch ----
  const fetchTrips = async (signal) => {
    const res = await api.get("/api/trips", {
      withCredentials: true,
      signal,
    });
    const data = Array.isArray(res.data) ? res.data : [];
    return data.map(normalizeTrip);
  };

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const data = await fetchTrips(ac.signal);
        setTrips(data);
      } catch (e) {
        if (ac.signal.aborted) return;
        setErr(e?.response?.data?.message || e.message || "Failed to load trips");
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();
    return () => ac.abort();
  }, []);

  if (!profile) return <div className="p-6">Loading user…</div>;
  const { role, name } = profile;

  const today = dayjs().startOf("day");

  const { total, upcoming, statusCounts } = useMemo(() => {
    const counts = { pending: 0, approved: 0, completed: 0, cancelled: 0, rejected: 0, unknown: 0 };
    let upc = 0;
    (trips || []).forEach((t) => {
      const d = getDate(t);
      const s = getStatus(t);
      if (d) {
        const dj = dayjs(d);
        // Match the table rule exactly: today OR future
        if (dj.isSame(today, "day") || dj.isAfter(today)) upc += 1;
      }
      counts[s] = (counts[s] ?? 0) + 1;
    });
    return { total: trips?.length || 0, upcoming: upc, statusCounts: counts };
  }, [trips, today]);

  // 👉 Agenda list: exclude Rejected/Canceled + only today or later
  const upcomingTrips = useMemo(() => {
    return (trips || [])
      .filter((t) => {
        const d = getDate(t);
        if (!d) return false;
        const dj = dayjs(d);
        const isFutureOrToday = dj.isSame(today, "day") || dj.isAfter(today);
        return isFutureOrToday && !isCancelledOrRejected(t);
      })
      .sort((a, b) => dayjs(getDate(a)).valueOf() - dayjs(getDate(b)).valueOf())
      .slice(0, MAX_UPCOMING);
  }, [trips, today]);

  const formatWhen = (t) => {
    const d = getDate(t);
    if (!d) return "-";
    const dj = dayjs(d);
    const time = getTime(t) || (dj.isValid() ? dj.format("h:mm A") : "");
    const dateTxt = dj.isValid() ? dj.format("ddd, MMM D") : "-";
    return time ? `${dateTxt} • ${time}` : dateTxt;
  };

  const actionNeeded = (t) => {
    const s = getStatus(t); // use normalized status everywhere
    if (role === "bus_company") {
      if (s === "pending") return "Review & Accept/Reject";
      if (s === "approved") return "Assign bus";
      if (s === "completed") return "No action";
    } else if (role === "school_staff") {
      if (s === "pending") return "Awaiting bus company (you can Cancel)";
      if (s === "approved") return "Add passengers";
      if (s === "completed") return "No action";
    } else if (role === "admin") {
      if (s === "pending") return "Monitor pending";
      if (s === "approved") return "Monitor assignment";
      if (s === "completed") return "No action";
    }
    return "—";
  };

  const staffCTA =
    role === "school_staff" ? (
      <RequestTripButton
        onSuccess={async () => {
          try {
            setLoading(true);
            const data = await fetchTrips(); // reuse single fetch path
            setTrips(data);
          } finally {
            setLoading(false);
          }
        }}
        hidden={isEditing}
      />
    ) : null;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">
          Welcome{role !== "admin" ? "," : " Admin,"} {name}
        </h2>
        <p className="text-gray-500">
          Here’s a quick snapshot of your trips
          {role === "admin" ? " across all organizations" : ""}.
        </p>
      </div>

      {role === "admin" && (
        <Section title="User & Role Management">
          <AdminUsers />
        </Section>
      )}

      {role === "school_staff" && <div className="mb-6 flex justify-end">{staffCTA}</div>}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card title="Total trips" value={loading ? "…" : total} />
        <Card title="Upcoming (from today)" value={loading ? "…" : upcoming} />
        <Card title="Pending requests" value={loading ? "…" : statusCounts.pending || 0} />
        <Card title="Cancelled" value={loading ? "…" : statusCounts.cancelled || 0} />
      </div>

      {/* ✅ Upcoming Agenda — excludes Rejected & Cancelled */}
      <div className="mt-6">
        <Section title="Upcoming Trips">
          {loading ? (
            <div className="text-gray-500 text-sm">Loading upcoming trips…</div>
          ) : upcomingTrips.length === 0 ? (
            <div className="text-gray-500 text-sm">No upcoming trips found.</div>
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="py-2 pr-4">When</th>
                    <th className="py-2 pr-4">Destination</th>
                    <th className="py-2 pr-4">Students</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2">Action needed</th>
                  </tr>
                </thead>
                <tbody>
                  {upcomingTrips.map((t) => (
                    <tr key={t.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 whitespace-nowrap">{formatWhen(t)}</td>
                      <td className="py-2 pr-4">
                        <button
                          type="button"
                          onClick={() => setSelectedTrip(t)}
                          className="text-blue-600 hover:underline font-medium"
                          title="View trip details"
                        >
                          {t.destination || t.tripType || "—"}
                        </button>
                      </td>
                      <td className="py-2 pr-4">{t.students ?? "—"}</td>
                      <td className="py-2 pr-4">
                        {/* Use normalized status for consistent badges */}
                        <StatusBadge status={getStatus(t)} />
                      </td>
                      <td className="py-2 text-gray-700">{actionNeeded(t)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>

      {err && (
        <div className="mt-6 rounded-lg bg-red-50 text-red-700 p-3 border border-red-100">
          {err}
        </div>
      )}

      {selectedTrip && (
        <ModalWrapper onClose={() => setSelectedTrip(null)}>
          <TripDetails trip={selectedTrip} />
        </ModalWrapper>
      )}
    </div>
  );
};

export default Dashboard;
