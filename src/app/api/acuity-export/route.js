import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

function csvVal(val) {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function formatAcuityDateTime(dateVal) {
  if (!dateVal) return "";
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return "";
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${month}/${day}/${year} ${hours}:${minutes} ${ampm}`;
}

function splitName(fullName) {
  if (!fullName) return { first: "", last: "" };
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: "" };
  const first = parts[0];
  const last = parts.slice(1).join(" ");
  return { first, last };
}

export async function GET(request) {
  const session = await auth();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  const tenantId = 1;

  let whereClause = "WHERE a.tenant_id = $1 AND a.status != 'cancelled'";
  const params = [tenantId];

  if (startDate) {
    params.push(startDate);
    whereClause += ` AND a.start_time >= $${params.length}`;
  }
  if (endDate) {
    // Add 1 day to include the full end date
    const endDatePlusOne = new Date(endDate);
    endDatePlusOne.setDate(endDatePlusOne.getDate() + 1);
    params.push(endDatePlusOne.toISOString().split("T")[0]);
    whereClause += ` AND a.start_time < $${params.length}`;
  }

  const appointments = await sql(
    `
    SELECT
      a.id,
      a.start_time,
      a.created_at,
      a.notes,
      a.status,
      a.booked_by,
      a.balance_due,
      a.payment_status,
      a.payments_total,
      a.vehicle_category,
      c.name AS client_name,
      c.phone AS client_phone,
      c.email AS client_email,
      e.name AS driver_name,
      COALESCE(
        (SELECT SUM(aps.duration_minutes * aps.quantity)
         FROM appointment_services aps
         WHERE aps.appointment_id = a.id),
        75
      ) AS total_duration_minutes,
      COALESCE(
        (SELECT STRING_AGG(s.name, ', ' ORDER BY s.display_order)
         FROM appointment_services aps
         JOIN services s ON s.id = aps.service_id
         WHERE aps.appointment_id = a.id),
        'Transportation'
      ) AS service_names
    FROM appointments a
    LEFT JOIN clients c ON c.id = a.client_id
    LEFT JOIN employees e ON e.id = a.employee_id
    ${whereClause}
    ORDER BY a.start_time ASC
    `,
    params,
  );

  const headers = [
    "Start Time",
    "End Time",
    "Time Zone",
    "First Name",
    "Last Name",
    "Phone",
    "Email",
    "Appointment Type",
    "Calendar",
    "Price",
    "Paid",
    "Amount Paid Online",
    "Discount Code",
    "Notes",
    "Date Scheduled",
    "Label",
    "Scheduled By",
    "Appointment ID",
  ];

  const rows = appointments.map((appt) => {
    const startTime = new Date(appt.start_time);
    const endTime = new Date(
      startTime.getTime() + (appt.total_duration_minutes || 75) * 60000,
    );
    const { first, last } = splitName(appt.client_name);
    const paid =
      appt.payment_status === "paid" || appt.payment_status === "partial"
        ? "yes"
        : "no";
    const amountPaid =
      appt.payments_total != null
        ? `$${parseFloat(appt.payments_total).toFixed(2)}`
        : "$0.00";
    const price =
      appt.balance_due != null
        ? `$${parseFloat(appt.balance_due).toFixed(2)}`
        : "$0.00";

    return [
      formatAcuityDateTime(startTime),
      formatAcuityDateTime(endTime),
      "America/Chicago",
      first,
      last,
      appt.client_phone || "",
      appt.client_email || "",
      appt.service_names || "Transportation",
      appt.driver_name || "",
      price,
      paid,
      amountPaid,
      "",
      appt.notes || "",
      formatAcuityDateTime(appt.created_at),
      appt.status || "",
      appt.booked_by || "Admin",
      String(appt.id),
    ]
      .map(csvVal)
      .join(",");
  });

  const csvContent = [headers.map(csvVal).join(","), ...rows].join("\n");

  const today = new Date().toISOString().split("T")[0];
  return new Response(csvContent, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="acuity-export-${today}.csv"`,
    },
  });
}
