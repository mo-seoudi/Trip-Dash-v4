import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/apiClient"; // axios instance with withCredentials: true
import AdminUsers from "./AdminUsers";
import RequestTripButton from "../components/RequestTripButton";

import {
  ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip,
  PieChart, Pie, Cell,
} from "recharts";

// ---- Small UI helpers ------------------------------------------------------
const Card = ({ title, value, sub }) => (
  <div className="rounded-2xl bg-white shadow-sm p-5 border border-gray-100">
    <p className="text-sm text-gray-500">{title}</p>
    <p className="text-3xl font-semibold mt-1">{value}</p>
    {sub ? <p className="text-xs text-gray-400 mt-1">{sub}</p> : null}
  </div>
);

const Section = ({ title, children, right }) => (
  <div className="mb-8">
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-lg font-semibold">{title}</h3>
      {right}
    </div>
    <div className="rounded-2xl bg-white shadow-sm p-5 border border-gray-100">{children}</div>
  </div>
);

// ---- Dashboard --------------------------------------------------------------
const Dashboard = () => {
  const { profile } = useAuth();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        setErr(null);

        // If you already have a trips fetcher (used by All Trips), import & call that instead.
        // This assumes your API lists trips the same way the All Trips page does.
        const res = await api.get("/api/trips"); // adjust if your route differs
        if (!mounted) return;
        setTrips(Array.isArray(res.data) ? res.data : res.data?.items || []);
      } catch (e) {
        if (!mounted) return;
        setErr(e?.response?.data?.message || e.message || "Failed to load trips");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, []);

  if (!profile) return <div className="p-6">Loading user…</div>;
  const { role, name } = profile;

  // ---- Normalizers (tolerant to slightly different field names) ------------
  const getDate = (t) =>
    t?.date || t?.tripDate || t?.startDate || t?.createdAt || null;

  const getStatus = (t) =>
    (t?.status || t?.tripStatus || "unknown").toLowerCase();

  // ---- Computed summaries ---------------------------------------------------
  const today = dayjs().startOf("day");

  const {
    total,
    upcoming,
    statusCounts,
    monthlySeries,
    recent,
  } = useMemo(() => {
    const counts = { pending: 0, approved: 0, completed: 0, cancelled: 0, unknown: 0 };
    const monthKey = (d) => dayjs(d).format("YYYY-MM");

    // seed last 12 months so chart doesn’t look empty
    const months = [];
    for (let i = 11; i >= 0; i--) {
      months.push(dayjs().subtract(i, "month").format("YYYY-MM"));
    }
    const monthMap = Object.fromEntries(months.map((m) => [m, 0]));

    let upc = 0;
    const safeTrips = (trips || []).filter(Boolean);

    safeTrips.forEach((t) => {
      const d = getDate(t);
      const s = getStatus(t);

      if (d && dayjs(d).isAfter(today.subtract(1, "day"))) upc += 1;
      if (counts[s] !== undefined) counts[s] += 1;
      else counts.unknown += 1;

      if (d) {
        const k = monthKey(d);
        if (k in monthMap) monthMap[k] += 1;
      }
    });

    const monthlySeries = months.map((m) => ({
      month: dayjs(m + "-01").format("MMM YYYY"),
      trips: monthMap[m],
    }));

    const recent = [...safeTrips]
      .sort((a, b) => dayjs(getDate(b)).valueOf() - dayjs(getDate(a)).valueOf())
      .slice(0, 8);

    return {
      total: safeTrips.length,
      upcoming: upc,
      statusCounts: counts,
      monthlySeries,
      recent,
    };
  }, [trips]);

  // ---- Role-specific callouts ------------------------------------------------
  const staffCTA = role === "school_staff" ? (
    <RequestTripButton onSuccess={() => { /* you could refetch here */ }} hidden={isEditing} />
  ) : null;

  // ---- Colors for Status pie -------------------------------------------------
  const statusData = [
    { name: "Pending", key: "pending" },
    { name: "Approved", key: "approved" },
    { name: "Completed", key: "completed" },
    { name: "Cancelled", key: "cancelled" },
    { name: "Unknown", key: "unknown" },
  ].map((s) => ({ ...s, value: statusCounts[s.key] || 0 }));

  const COLORS = ["#f59e0b", "#3b82f6", "#10b981", "#ef4444", "#9ca3af"];

  // ---- Render ---------------------------------------------------------------
  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Welcome{role !== "admin" ? "," : " Admin,"} {name}</h2>
        <p className="text-gray-500">
          Here’s a quick snapshot of your trips{role === "admin" ? " across all organizations" : ""}.
        </p>
      </div>

      {role === "admin" && (
        <div className="mb-8">
          <Section title="User & Role Management">
            <AdminUsers />
          </Section>
        </div>
      )}

      {role === "school_staff" && (
        <div className="mb-8">
          <div className="flex justify-end">{staffCTA}</div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card title="Total trips" value={loading ? "…" : total} />
        <Card title="Upcoming (from today)" value={loading ? "…" : upcoming} />
        <Card title="Pending requests" value={loading ? "…" : statusCounts.pending || 0} />
        <Card title="Cancelled" value={loading ? "…" : statusCounts.cancelled || 0} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Section title="Trips by month (last 12)">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlySeries}>
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="trips" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>

        <Section title="Status breakdown" >
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                >
                  {statusData.map((entry, idx) => (
                    <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-3 mt-3">
              {statusData.map((s, idx) => (
                <div key={s.key} className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="inline-block w-3 h-3 rounded" style={{ background: COLORS[idx % COLORS.length] }} />
                  {s.name} ({s.value})
                </div>
              ))}
            </div>
          </div>
        </Section>

        <Section title="Recent trips" right={
          <a href="/trips" className="text-sm text-blue-600 hover:underline">View all</a>
        }>
          {loading ? (
            <p className="text-gray-500">Loading…</p>
          ) : recent.length === 0 ? (
            <div className="flex items-center justify-between">
              <p className="text-gray-500">No trips yet.</p>
              {role === "school_staff" && staffCTA}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="py-2 pr-4">Trip</th>
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Passengers</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((t) => (
                    <tr key={t.id} className="border-t">
                      <td className="py-2 pr-4">
                        {t.title || t.name || t.destination || `Trip #${t.id}`}
                      </td>
                      <td className="py-2 pr-4">
                        {getDate(t) ? dayjs(getDate(t)).format("DD MMM YYYY") : "—"}
                      </td>
                      <td className="py-2 pr-4 capitalize">{getStatus(t)}</td>
                      <td className="py-2 pr-4">{t.passengerCount ?? t?.passengers?.length ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>

      {err && (
        <div className="mt-4 rounded-lg bg-red-50 text-red-700 p-3 border border-red-100">
          {err}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
