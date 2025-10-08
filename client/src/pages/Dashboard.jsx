// client/src/pages/Dashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { useAuth } from "../context/AuthContext";

import AdminUsers from "./AdminUsers";
import RequestTripButton from "../components/RequestTripButton";
import ModalWrapper from "../components/ModalWrapper";
import TripDetails from "../components/TripDetails";
import StatusBadge from "../components/StatusBadge";

import { getAllTrips } from "../services/tripService";

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

export default function Dashboard() {
  const { profile } = useAuth();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [showDetailsTrip, setShowDetailsTrip] = useState(null);

  // single canonical fetch using tripService (same as other screens)
  const refetch = async () => {
    try {
      setLoading(true);
      setErr(null);
      const rows = await getAllTrips();
      setTrips(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || "Failed to load trips");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refetch();
  }, []);

  if (!profile) return <div className="p-6">Loading user…</div>;
  const { role, name } = profile;

  // Helpers
  const isRejectedOrCanceled = (t) => {
    const s = String(t?.status || "").toLowerCase();
    return s === "rejected" || s === "canceled" || s === "cancelled";
  };

  const today = dayjs().startOf("day");

  const { total, upcoming, statusCounts, nextTrips } = useMemo(() => {
    const counts = { pending: 0, approved: 0, completed: 0, cancelled: 0, unknown: 0 };
    const future = [];
    (trips || []).forEach((t) => {
      const raw = String(t?.status || "").toLowerCase();
      if (raw === "pending") counts.pending++;
      else if (raw === "approved" || raw === "confirmed" || raw === "accepted") counts.approved++;
      else if (raw === "completed" || raw === "done") counts.completed++;
      else if (raw === "cancelled" || raw === "canceled") counts.cancelled++;
      else counts.unknown++;

      const d = t?.date ? dayjs(t.date) : null;
      if (d && d.isAfter(today.subtract(1, "day")) && !isRejectedOrCanceled(t)) {
        future.push(t);
      }
    });

    future.sort((a, b) => {
      const ad = a.date ? new Date(a.date).getTime() : 0;
      const bd = b.date ? new Date(b.date).getTime() : 0;
      return ad - bd;
    });

    return {
      total: trips?.length || 0,
      upcoming: future.length,
      statusCounts: counts,
      nextTrips: future.slice(0, 10), // show at most 10
    };
  }, [trips]);

  const staffCTA =
    role === "school_staff" ? (
      <RequestTripButton
        onSuccess={async () => {
          await refetch(); // keep behavior consistent
        }}
      />
    ) : null;

  const fmtWhen = (t) => {
    const d = t?.date ? new Date(t.date) : null;
    const time = t?.departureTime || "";
    if (!d) return "-";
    const dateStr = d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "2-digit",
    });
    return `${dateStr} · ${time}`;
  };

  const actionNeeded = (t) => {
    const s = String(t?.status || "").toLowerCase();
    if (s === "pending") return "Awaiting bus company (you can Cancel)";
    if (s === "accepted") return "Assign buses";
    if (s === "confirmed") return "Manage passengers";
    if (s === "completed") return "—";
    return "—";
    };

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

      {/* Upcoming Trips (agenda-style) */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold mb-3">Upcoming Trips</h3>
        <div className="rounded-2xl bg-white shadow-sm border border-gray-100">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2 w-[220px]">When</th>
                  <th className="text-left px-4 py-2">Destination</th>
                  <th className="text-left px-4 py-2 w-[100px]">Students</th>
                  <th className="text-left px-4 py-2 w-[140px]">Status</th>
                  <th className="text-left px-4 py-2">Action needed</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-gray-500">
                      Loading…
                    </td>
                  </tr>
                ) : nextTrips.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-gray-500">
                      No upcoming trips found.
                    </td>
                  </tr>
                ) : (
                  nextTrips.map((t) => (
                    <tr key={t.id} className="border-t">
                      <td className="px-4 py-2 whitespace-nowrap">{fmtWhen(t)}</td>
                      <td className="px-4 py-2">
                        <button
                          type="button"
                          className="text-gray-800 hover:text-blue-600"
                          onClick={() => setShowDetailsTrip(t)}
                          title="View details"
                        >
                          {t.destination || "-"}
                        </button>
                      </td>
                      <td className="px-4 py-2">{t.students ?? "-"}</td>
                      <td className="px-4 py-2">
                        <StatusBadge status={t.status} />
                      </td>
                      <td className="px-4 py-2 text-gray-600">{actionNeeded(t)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {err && (
        <div className="mt-6 rounded-lg bg-red-50 text-red-700 p-3 border border-red-100">
          {err}
        </div>
      )}

      {showDetailsTrip && (
        <ModalWrapper onClose={() => setShowDetailsTrip(null)}>
          <TripDetails trip={showDetailsTrip} />
        </ModalWrapper>
      )}
    </div>
  );
}
