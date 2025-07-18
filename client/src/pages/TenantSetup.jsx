// src/pages/TenantSetup.jsx
import React, { useState } from "react";

export default function TenantConfigSetupPage() {
  const [formData, setFormData] = useState({
    tenantId: "",
    name: "",
    dbProvider: "firebase",
    firebase: {
      apiKey: "",
      projectId: "",
      privateKey: "",
      clientEmail: "",
    },
    mongo: {
      uri: "",
    },
    sql: {
      host: "",
      user: "",
      password: "",
    },
  });

  const handleChange = (e, path = []) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const updated = { ...prev };
      if (path.length > 0) {
        path.reduce((obj, key, i) => {
          if (i === path.length - 1) obj[key] = value;
          return obj[key];
        }, updated);
      } else {
        updated[name] = value;
      }
      return updated;
    });
  };

  const handleSubmit = async () => {
    try {
      const response = await fetch("/api/admin/tenant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await response.json();
      alert("Tenant config saved: " + JSON.stringify(data));
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const provider = formData.dbProvider;

  return (
    <div className="p-6 max-w-2xl mx-auto bg-white rounded shadow">
      <h2 className="text-xl font-bold mb-4">Tenant Configuration</h2>

      <div className="mb-4">
        <label className="block font-medium">Tenant ID</label>
        <input
          name="tenantId"
          value={formData.tenantId}
          onChange={handleChange}
          className="border p-2 w-full rounded"
        />
      </div>

      <div className="mb-4">
        <label className="block font-medium">Name</label>
        <input
          name="name"
          value={formData.name}
          onChange={handleChange}
          className="border p-2 w-full rounded"
        />
      </div>

      <div className="mb-4">
        <label className="block font-medium">Database Provider</label>
        <select
          name="dbProvider"
          value={formData.dbProvider}
          onChange={handleChange}
          className="border p-2 rounded w-full"
        >
          <option value="firebase">Firebase</option>
          <option value="mongo">MongoDB</option>
          <option value="sql">SQL</option>
        </select>
      </div>

      {provider === "firebase" && (
        <>
          <div className="mb-4">
            <label className="block font-medium">API Key</label>
            <input
              value={formData.firebase.apiKey}
              onChange={(e) => handleChange(e, ["firebase", "apiKey"])}
              className="border p-2 w-full rounded"
            />
          </div>
          <div className="mb-4">
            <label className="block font-medium">Project ID</label>
            <input
              value={formData.firebase.projectId}
              onChange={(e) => handleChange(e, ["firebase", "projectId"])}
              className="border p-2 w-full rounded"
            />
          </div>
          <div className="mb-4">
            <label className="block font-medium">Client Email</label>
            <input
              value={formData.firebase.clientEmail}
              onChange={(e) => handleChange(e, ["firebase", "clientEmail"])}
              className="border p-2 w-full rounded"
            />
          </div>
          <div className="mb-4">
            <label className="block font-medium">Private Key</label>
            <textarea
              rows={4}
              value={formData.firebase.privateKey}
              onChange={(e) => handleChange(e, ["firebase", "privateKey"])}
              className="border p-2 w-full rounded"
            />
          </div>
        </>
      )}

      {provider === "mongo" && (
        <div className="mb-4">
          <label className="block font-medium">Mongo URI</label>
          <input
            value={formData.mongo.uri}
            onChange={(e) => handleChange(e, ["mongo", "uri"])}
            className="border p-2 w-full rounded"
          />
        </div>
      )}

      {provider === "sql" && (
        <>
          <div className="mb-4">
            <label className="block font-medium">SQL Host</label>
            <input
              value={formData.sql.host}
              onChange={(e) => handleChange(e, ["sql", "host"])}
              className="border p-2 w-full rounded"
            />
          </div>
          <div className="mb-4">
            <label className="block font-medium">SQL User</label>
            <input
              value={formData.sql.user}
              onChange={(e) => handleChange(e, ["sql", "user"])}
              className="border p-2 w-full rounded"
            />
          </div>
          <div className="mb-4">
            <label className="block font-medium">SQL Password</label>
            <input
              type="password"
              value={formData.sql.password}
              onChange={(e) => handleChange(e, ["sql", "password"])}
              className="border p-2 w-full rounded"
            />
          </div>
        </>
      )}

      <button
        onClick={handleSubmit}
        className="bg-blue-600 text-white py-2 px-4 rounded w-full mt-4"
      >
        Save Tenant Config
      </button>
    </div>
  );
}
