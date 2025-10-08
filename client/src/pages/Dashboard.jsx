// src/pages/Dashboard.jsx  
import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { useAuth } from "../context/AuthContext";
import api from "../services/apiClient";
import AdminUsers from "./AdminUsers";
import RequestTripButton from "../components/RequestTripButton";

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

const Dashboard = () => {
  const { profile } = useAuth();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [isEditing] = useState(false);

  // ---- single, canonical endpoint ----
  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const res = await api.get("/api/trips", {
          withCredentials: true, // include cookie
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

  const staffCTA =
    role === "school_staff" ? (
      <RequestTripButton
        onSuccess={async () => {
          // Optional: light refetch after creating a trip
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

      {err && (
        <div className="mt-6 rounded-lg bg-red-50 text-red-700 p-3 border border-red-100">
          {err}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
