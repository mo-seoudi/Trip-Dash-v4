// src/pages/Dashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { useAuth } from "../context/AuthContext";
import api from "../services/apiClient";
import AdminUsers from "./AdminUsers";
import RequestTripButton from "../components/RequestTripButton";
import StatusBadge from "../components/StatusBadge";
import ModalWrapper from "../components/ModalWrapper";      // ✅ NEW
import TripDetails from "../components/TripDetails";         // ✅ NEW

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

const MAX_UPCOMING = 10; // ✅ cap the agenda list

const Dashboard = () => {
  const { profile } = useAuth();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [isEditing] = useState(false);

  // For TripDetails modal
  const [selectedTrip, setSelectedTrip] = useState(null);   // ✅ NEW

  // ---- single, canonical endpoint ----
  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const res = await api.get("/api/trips", {
          withCredentials: true,
          signal: ac.signal,
        });
        const data = Array.isArray(res.data) ? res.data : [];
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

  // ---- tolerant helpers for slightly different trip shapes ----
  const getDate = (t) =>
    t?.date || t?.tripDate || t?.startDate || t?.departureTime || t?.createdAt || null;

  const getStatus = (t) => {
    const raw = (t?.status || t?.tripStatus || t?.state || "").toString().toLowerCase();
    if (["pending", "requested", "awaiting_approval"].includes(raw)) return "pending";
    if (["approved", "confirmed", "accepted"].includes(raw)) return "approved";
    if (["completed", "done", "finished"].includes(raw)) return "completed";
    if (["cancelled", "canceled"].includes(raw)) return "cancelled";
    return "unknown";
  };

  const today = dayjs().startOf("day");

  const { total, upcoming, statusCounts } = useMemo(() => {
    const counts = { pending: 0, approved: 0, completed: 0, cancelled: 0, unknown: 0 };
    let upc = 0;
    (trips || []).forEach((t) => {
      const d = getDate(t);
      const s = getStatus(t);
      if (d && dayjs(d).isAfter(today.subtract(1, "day"))) upc += 1;
      counts[s] = (counts[s] ?? 0) + 1;
    });
    return { total: trips?.length || 0, upcoming: upc, statusCounts: counts };
  }, [trips]);

  // 👉 Agenda list: next upcoming trips (from today), sorted by date/time
  const upcomingTrips = useMemo(() => {
    const rows = (trips || [])
      .filter((t) => {
        const d = getDate(t);
        return (d && dayjs(d).isSame(today, "day")) || (d && dayjs(d).isAfter(today));
      })
      .sort((a, b) => dayjs(getDate(a)).valueOf() - dayjs(getDate(b)).valueOf())
      .slice(0, MAX_UPCOMING);                       // ✅ limit to 10
    return rows;
  }, [trips, today]);

  const formatWhen = (t) => {
    const d = getDate(t);
    if (!d) return "-";
    const dj = dayjs(d);
    const time = t?.departureTime || t?.time || (dj.isValid() ? dj.format("h:mm A") : "");
    const dateTxt = dj.isValid() ? dj.format("ddd, MMM D") : "-";
    return time ? `${dateTxt} • ${time}` : dateTxt;
  };

  const actionNeeded = (t) => {
    const s = (t?.status || "").toString().toLowerCase();
    if (role === "bus_company") {
      if (s === "pending") return "Review & Accept/Reject";
      if (s === "accepted") return "Assign bus";
      if (s === "confirmed") return "Complete after trip";
    } else if (role === "school_staff") {
      if (s === "pending") return "Awaiting bus company (you can Cancel)";
      if (s === "accepted") return "Add passengers";
      if (s === "confirmed") return "Manage passengers";
    } else if (role === "admin") {
      if (s === "pending") return "Monitor pending";
      if (s === "accepted") return "Monitor assignment";
      if (s === "confirmed") return "Monitor completion";
    }
    if (s === "completed") return "No action";
    if (s === "cancelled" || s === "canceled") return "No action";
    return "—";
  };

  const staffCTA =
    role === "school_staff" ? (
      <RequestTripButton
        onSuccess={async () => {
          try {
            setLoading(true);
            const res = await api.get("/api/trips", { withCredentials: true });
            setTrips(Array.isArray(res.data) ? res.data : []);
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

      {/* ✅ New: Upcoming Agenda */}
      <div className="mt-6">
        <Section title={`Upcoming Trips (next ${MAX_UPCOMING})`}>
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
                          onClick={() => setSelectedTrip(t)}              // ✅ open modal
                          className="text-blue-600 hover:underline font-medium"
                          title="View trip details"
                        >
                          {t.destination || t.tripType || "—"}
                        </button>
                      </td>
                      <td className="py-2 pr-4">{t.students ?? "—"}</td>
                      <td className="py-2 pr-4">
                        <StatusBadge status={t.status} />
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

      {/* ✅ TripDetails modal (reused app-wide) */}
      {selectedTrip && (
        <ModalWrapper onClose={() => setSelectedTrip(null)}>
          <TripDetails trip={selectedTrip} />
        </ModalWrapper>
      )}
    </div>
  );
};

export default Dashboard;
