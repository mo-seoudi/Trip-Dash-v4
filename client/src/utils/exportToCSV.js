export function exportToCSV(data, filename = "export") {
  if (!data.length) return;

  // Your specified column order
  const headers = [
    "tripType", "destination", "date", "departureTime", "status", "price",
    "busInfo", "students", "boosterSeatCount", "returnDate", "returnTime",
    "driverInfo", "notes", "createdBy", "createdAt", "editRequest",
    "cancelRequest", "customType", "id"
  ];

  const rows = data.map((row) =>
    headers.map((field) => {
      let value = row[field];

      // Handle busInfo (export bus name)
      if (field === "busInfo" && typeof value === "object" && value !== null) {
        value = value.name ?? "";
      }

      // Handle driverInfo (export driver name)
      if (field === "driverInfo" && typeof value === "object" && value !== null) {
        value = value.name ?? "";
      }

      // Handle students array
      if (field === "students" && Array.isArray(value)) {
        value = value.join("; ");
      }

      // Format dates
      if ((field === "date" || field === "returnDate" || field === "createdAt") && value) {
        try {
          value = new Date(value).toLocaleDateString("en-CA"); // YYYY-MM-DD
        } catch {
          value = value;
        }
      }

      return `"${value ?? ""}"`;
    }).join(",")
  );

  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = window.URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.setAttribute("href", url);
  a.setAttribute("download", `${filename}.csv`);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
