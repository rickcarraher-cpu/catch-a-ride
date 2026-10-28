import sql from "@/app/api/utils/sql";
import { generateNextBookingNumber } from "@/app/api/utils/booking-number";

// Allow up to 5 minutes for large imports
export const maxDuration = 300;

function makeIdMap() {
  return new Map(); // oldId → newId
}

// Delete ALL tenant data in FK-safe waves, parallelising within each wave
async function deleteAllTenantData(tenantId) {
  // Wave 1: leaf tables that reference appointments (NO ACTION / SET NULL only — not auto-cascaded)
  await Promise.all([
    sql`DELETE FROM invoices WHERE tenant_id = ${tenantId}`,
    sql`DELETE FROM communication_failures WHERE appointment_id IN (SELECT id FROM appointments WHERE tenant_id = ${tenantId})`,
    sql`DELETE FROM square_webhook_logs WHERE tenant_id = ${tenantId}`,
    sql`DELETE FROM email_logs WHERE tenant_id = ${tenantId}`,
    sql`DELETE FROM notification_logs WHERE entity_type = 'appointment' AND entity_id IN (SELECT id FROM appointments WHERE tenant_id = ${tenantId})`,
    sql`DELETE FROM cancellation_alerts WHERE tenant_id = ${tenantId}`,
    sql`DELETE FROM passenger_cancellation_alerts WHERE appointment_id IN (SELECT id FROM appointments WHERE tenant_id = ${tenantId})`,
    sql`DELETE FROM transactions WHERE tenant_id = ${tenantId}`,
    sql`DELETE FROM recurring_appointments WHERE tenant_id = ${tenantId}`,
  ]);

  // Wave 2: delete appointments (cascades → appointment_services, payments→payment_events, tour_itinerary, tour_participants)
  //         also conversations (SET NULL on appointment_id) and sms_messages (SET NULL)
  await sql`DELETE FROM appointments WHERE tenant_id = ${tenantId}`;

  // Wave 3: weddings reference clients (NO ACTION), so delete before clients
  //         conversation_participants reference clients & employees (CASCADE but be explicit)
  //         appointment_services already gone via cascade, so services are safe
  await Promise.all([
    sql`DELETE FROM weddings WHERE tenant_id = ${tenantId}`,
    sql`DELETE FROM services WHERE tenant_id = ${tenantId}`,
  ]);

  // Wave 4: clients (conversation_participants cascade, sms_messages SET NULL, tour_participants SET NULL)
  await sql`DELETE FROM clients WHERE tenant_id = ${tenantId}`;

  // Wave 5: employee-adjacent tables that do NOT cascade
  await Promise.all([
    sql`DELETE FROM vehicle_assignments WHERE vehicle_id IN (SELECT id FROM vehicles WHERE employee_id IN (SELECT id FROM employees WHERE tenant_id = ${tenantId}))`,
    sql`DELETE FROM timesheet_approvals WHERE employee_id IN (SELECT id FROM employees WHERE tenant_id = ${tenantId})`,
    sql`DELETE FROM driver_mileage_approvals WHERE employee_id IN (SELECT id FROM employees WHERE tenant_id = ${tenantId})`,
    sql`DELETE FROM recurring_blocked_times WHERE employee_id IN (SELECT id FROM employees WHERE tenant_id = ${tenantId})`,
    sql`DELETE FROM payroll_submissions WHERE tenant_id = ${tenantId}`,
  ]);

  // Wave 6: vehicles (has CASCADE from employees, but vehicle_assignments blocked it before — now safe)
  await sql`DELETE FROM vehicles WHERE employee_id IN (SELECT id FROM employees WHERE tenant_id = ${tenantId})`;

  // Wave 7: employees (cascades → blocked_times, working_hours, conversation_participants)
  await sql`DELETE FROM employees WHERE tenant_id = ${tenantId}`;
}

/**
 * Batch-insert rows and return the inserted IDs in the same order.
 * columns: string[]  — column names (must match params order)
 * rows:    any[][]   — array of value arrays, one per row
 * batchSize: number  — rows per INSERT statement (default 100)
 */
async function batchInsert(table, columns, rows, batchSize = 100) {
  const allIds = [];
  const colCount = columns.length;
  const colList = columns.join(", ");

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const params = [];
    const valueSets = batch.map((row, rowIdx) => {
      const placeholders = columns.map(
        (_, colIdx) => `$${rowIdx * colCount + colIdx + 1}`,
      );
      params.push(...row);
      return `(${placeholders.join(", ")})`;
    });
    const inserted = await sql(
      `INSERT INTO ${table} (${colList}) VALUES ${valueSets.join(", ")} RETURNING id`,
      params,
    );
    allIds.push(...inserted.map((r) => r.id));
  }
  return allIds;
}

export async function POST(request) {
  const results = {
    drivers: { inserted: 0, skipped: 0, errors: [] },
    passengers: { inserted: 0, skipped: 0, errors: [] },
    services: { inserted: 0, skipped: 0, errors: [] },
    trips: { inserted: 0, skipped: 0, errors: [] },
    trip_services: { inserted: 0, skipped: 0, errors: [] },
    transactions: { inserted: 0, skipped: 0, errors: [] },
    recurring_trips: { inserted: 0, skipped: 0, errors: [] },
    working_hours: { inserted: 0, skipped: 0, errors: [] },
    blocked_times: { inserted: 0, skipped: 0, errors: [] },
    settings: { updated: 0, errors: [] },
  };

  try {
    let data;
    try {
      data = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON file" }, { status: 400 });
    }

    if (!data || typeof data !== "object") {
      return Response.json(
        { error: "JSON must be an object" },
        { status: 400 },
      );
    }

    const tenantId = 1;
    const sensitiveKeys = new Set([
      "quo_api_key",
      "sms_api_key",
      "quo_webhook_secret",
    ]);

    // ── REPLACE: wipe existing data before inserting ─────────────────────────
    await deleteAllTenantData(tenantId);

    // ── ID maps: old export IDs → newly inserted DB IDs ─────────────────────
    const driverIdMap = makeIdMap();
    const passengerIdMap = makeIdMap();
    const serviceIdMap = makeIdMap();
    const tripIdMap = makeIdMap();

    // ── 1. Drivers (batch) ───────────────────────────────────────────────────
    if (Array.isArray(data.drivers)) {
      const valid = data.drivers.filter((d) => {
        if (!d.name) {
          results.drivers.skipped++;
          return false;
        }
        return true;
      });
      if (valid.length > 0) {
        try {
          const ids = await batchInsert(
            "employees",
            [
              "tenant_id",
              "name",
              "email",
              "phone",
              "color",
              "salary_rate",
              "is_active",
            ],
            valid.map((d) => [
              tenantId,
              d.name,
              d.email || null,
              d.phone || null,
              d.color || "#2563EB",
              d.salary_rate ?? 0.75,
              d.is_active !== false,
            ]),
          );
          valid.forEach((d, i) => driverIdMap.set(d.id, ids[i]));
          results.drivers.inserted += valid.length;
        } catch (e) {
          results.drivers.errors.push(`Batch drivers insert: ${e.message}`);
        }
      }
    }

    // ── 2. Passengers (batch) ────────────────────────────────────────────────
    if (Array.isArray(data.passengers)) {
      const valid = data.passengers.filter((p) => {
        if (!p.name) {
          results.passengers.skipped++;
          return false;
        }
        return true;
      });
      if (valid.length > 0) {
        try {
          const ids = await batchInsert(
            "clients",
            ["tenant_id", "name", "email", "phone", "notes"],
            valid.map((p) => [
              tenantId,
              p.name,
              p.email || null,
              p.phone || null,
              p.notes || null,
            ]),
          );
          valid.forEach((p, i) => passengerIdMap.set(p.id, ids[i]));
          results.passengers.inserted += valid.length;
        } catch (e) {
          results.passengers.errors.push(
            `Batch passengers insert: ${e.message}`,
          );
        }
      }
    }

    // ── 3. Services (batch) ──────────────────────────────────────────────────
    if (Array.isArray(data.services)) {
      const valid = data.services.filter((s) => {
        if (!s.name) {
          results.services.skipped++;
          return false;
        }
        return true;
      });
      if (valid.length > 0) {
        try {
          const ids = await batchInsert(
            "services",
            [
              "tenant_id",
              "name",
              "description",
              "default_price",
              "duration_minutes",
              "is_variable_price",
              "display_order",
              "is_active",
            ],
            valid.map((s) => [
              tenantId,
              s.name,
              s.description || null,
              s.default_price ?? 0,
              s.duration_minutes ?? 60,
              s.is_variable_price === true,
              s.display_order ?? 0,
              s.is_active !== false,
            ]),
          );
          valid.forEach((s, i) => serviceIdMap.set(s.id, ids[i]));
          results.services.inserted += valid.length;
        } catch (e) {
          results.services.errors.push(`Batch services insert: ${e.message}`);
        }
      }
    }

    // ── 4. Trips (batch, then trip_services) ─────────────────────────────────
    if (Array.isArray(data.trips)) {
      // Pre-generate booking numbers sequentially
      const validTrips = [];
      const skippedTrips = [];
      data.trips.forEach((t) =>
        t.start_time ? validTrips.push(t) : skippedTrips.push(t),
      );
      results.trips.skipped += skippedTrips.length;

      if (validTrips.length > 0) {
        try {
          // Generate booking numbers
          const bookingNumbers = await Promise.all(
            validTrips.map((_, i) => generateNextBookingNumber(i)),
          );

          const ids = await batchInsert(
            "appointments",
            [
              "tenant_id",
              "client_id",
              "employee_id",
              "start_time",
              "status",
              "booked_by",
              "notes",
              "booking_number",
            ],
            validTrips.map((t, i) => [
              tenantId,
              passengerIdMap.get(t.client_id) ?? null,
              driverIdMap.get(t.employee_id) ?? null,
              t.start_time,
              t.status || "pending",
              t.booked_by || "Admin",
              t.notes || null,
              bookingNumbers[i],
            ]),
          );
          validTrips.forEach((t, i) => tripIdMap.set(t.id, ids[i]));
          results.trips.inserted += validTrips.length;

          // Trip services — collect all rows then batch insert
          const tsRows = [];
          const tsErrors = [];
          validTrips.forEach((t, i) => {
            if (!Array.isArray(t.services)) return;
            t.services.forEach((ts) => {
              tsRows.push([
                ids[i],
                serviceIdMap.get(ts.service_id) ?? null,
                ts.service_price ?? 0,
                ts.duration_minutes ?? 60,
                ts.quantity ?? 1,
              ]);
            });
          });
          if (tsRows.length > 0) {
            try {
              await batchInsert(
                "appointment_services",
                [
                  "appointment_id",
                  "service_id",
                  "service_price",
                  "duration_minutes",
                  "quantity",
                ],
                tsRows,
              );
              results.trip_services.inserted += tsRows.length;
            } catch (e) {
              results.trip_services.errors.push(
                `Batch trip_services insert: ${e.message}`,
              );
            }
          }
        } catch (e) {
          results.trips.errors.push(`Batch trips insert: ${e.message}`);
        }
      }
    }

    // ── 5. Transactions (batch) ──────────────────────────────────────────────
    if (Array.isArray(data.transactions)) {
      const valid = data.transactions.filter((tx) => {
        if (!tx.category || tx.amount == null) {
          results.transactions.skipped++;
          return false;
        }
        return true;
      });
      if (valid.length > 0) {
        try {
          // batchInsert doesn't RETURNING needed here — no ID map needed
          const colCount = 8;
          const colList =
            "tenant_id, appointment_id, category, method, amount, tip_amount, description, transaction_date";
          const batchSize = 100;
          for (let i = 0; i < valid.length; i += batchSize) {
            const batch = valid.slice(i, i + batchSize);
            const params = [];
            const valueSets = batch.map((tx, rowIdx) => {
              params.push(
                tenantId,
                tripIdMap.get(tx.appointment_id) ?? null,
                tx.category,
                tx.method || null,
                tx.amount,
                tx.tip_amount ?? 0,
                tx.description || null,
                tx.transaction_date || null,
              );
              const base = rowIdx * colCount;
              return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8})`;
            });
            await sql(
              `INSERT INTO transactions (${colList}) VALUES ${valueSets.join(",")}`,
              params,
            );
          }
          results.transactions.inserted += valid.length;
        } catch (e) {
          results.transactions.errors.push(
            `Batch transactions insert: ${e.message}`,
          );
        }
      }
    }

    // ── 6. Recurring Trips (batch) ───────────────────────────────────────────
    if (Array.isArray(data.recurring_trips)) {
      const valid = data.recurring_trips.filter((r) => {
        if (!r.start_time || !r.frequency) {
          results.recurring_trips.skipped++;
          return false;
        }
        return true;
      });
      if (valid.length > 0) {
        try {
          const colCount = 6;
          const colList =
            "tenant_id, client_id, employee_id, start_time, frequency, notes";
          const batchSize = 100;
          for (let i = 0; i < valid.length; i += batchSize) {
            const batch = valid.slice(i, i + batchSize);
            const params = [];
            const valueSets = batch.map((r, rowIdx) => {
              params.push(
                tenantId,
                passengerIdMap.get(r.client_id) ?? null,
                driverIdMap.get(r.employee_id) ?? null,
                r.start_time,
                r.frequency,
                r.notes || null,
              );
              const base = rowIdx * colCount;
              return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6})`;
            });
            await sql(
              `INSERT INTO recurring_appointments (${colList}) VALUES ${valueSets.join(",")}`,
              params,
            );
          }
          results.recurring_trips.inserted += valid.length;
        } catch (e) {
          results.recurring_trips.errors.push(
            `Batch recurring trips insert: ${e.message}`,
          );
        }
      }
    }

    // ── 7. Working Hours (batch) ─────────────────────────────────────────────
    if (Array.isArray(data.working_hours)) {
      const valid = data.working_hours.filter((w) => {
        if (
          w.day_of_week == null ||
          !w.start_time ||
          !w.end_time ||
          !driverIdMap.get(w.employee_id)
        ) {
          results.working_hours.skipped++;
          return false;
        }
        return true;
      });
      if (valid.length > 0) {
        try {
          const colCount = 4;
          const colList = "employee_id, day_of_week, start_time, end_time";
          const batchSize = 100;
          for (let i = 0; i < valid.length; i += batchSize) {
            const batch = valid.slice(i, i + batchSize);
            const params = [];
            const valueSets = batch.map((w, rowIdx) => {
              params.push(
                driverIdMap.get(w.employee_id),
                w.day_of_week,
                w.start_time,
                w.end_time,
              );
              const base = rowIdx * colCount;
              return `($${base + 1},$${base + 2},$${base + 3},$${base + 4})`;
            });
            await sql(
              `INSERT INTO working_hours (${colList}) VALUES ${valueSets.join(",")}`,
              params,
            );
          }
          results.working_hours.inserted += valid.length;
        } catch (e) {
          results.working_hours.errors.push(
            `Batch working hours insert: ${e.message}`,
          );
        }
      }
    }

    // ── 8. Blocked Times (batch) ─────────────────────────────────────────────
    if (Array.isArray(data.blocked_times)) {
      const valid = data.blocked_times.filter((b) => {
        if (!b.start_time || !b.end_time || !driverIdMap.get(b.employee_id)) {
          results.blocked_times.skipped++;
          return false;
        }
        return true;
      });
      if (valid.length > 0) {
        try {
          const colCount = 4;
          const colList = "employee_id, start_time, end_time, reason";
          const batchSize = 100;
          for (let i = 0; i < valid.length; i += batchSize) {
            const batch = valid.slice(i, i + batchSize);
            const params = [];
            const valueSets = batch.map((b, rowIdx) => {
              params.push(
                driverIdMap.get(b.employee_id),
                b.start_time,
                b.end_time,
                b.reason || null,
              );
              const base = rowIdx * colCount;
              return `($${base + 1},$${base + 2},$${base + 3},$${base + 4})`;
            });
            await sql(
              `INSERT INTO blocked_times (${colList}) VALUES ${valueSets.join(",")}`,
              params,
            );
          }
          results.blocked_times.inserted += valid.length;
        } catch (e) {
          results.blocked_times.errors.push(
            `Batch blocked times insert: ${e.message}`,
          );
        }
      }
    }

    // ── 9. Settings (upsert — never wipe all settings) ───────────────────────
    if (data.settings && typeof data.settings === "object") {
      for (const [key, value] of Object.entries(data.settings)) {
        if (sensitiveKeys.has(key)) continue;
        try {
          await sql`
            INSERT INTO settings (tenant_id, key, value)
            VALUES (${tenantId}, ${key}, ${String(value)})
            ON CONFLICT (tenant_id, key) DO UPDATE SET value = ${String(value)}
          `;
          results.settings.updated++;
        } catch (e) {
          results.settings.errors.push(`Setting "${key}": ${e.message}`);
        }
      }
    }

    const totalErrors = Object.values(results).reduce(
      (sum, r) => sum + (r.errors?.length || 0),
      0,
    );
    return Response.json({
      success: true,
      results,
      total_errors: totalErrors,
      message:
        totalErrors === 0
          ? "Import completed successfully. All existing data was replaced."
          : `Import completed with ${totalErrors} error(s). See results for details.`,
    });
  } catch (error) {
    console.error("[Import] Fatal error:", error);
    return Response.json(
      { error: "Import failed: " + error.message },
      { status: 500 },
    );
  }
}
