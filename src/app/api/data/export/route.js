import sql from "@/app/api/utils/sql";

export async function GET() {
  try {
    const tenantId = 1;

    console.log("[Export] Starting data export...");

    // Fetch all data in parallel
    let queryResults;
    try {
      // Execute all queries in a transaction using function syntax
      queryResults = await sql.transaction((txn) => [
        txn`SELECT id, name, slug, email, phone, address, logo_url FROM tenants WHERE id = ${tenantId}`,
        txn`SELECT id, name, email, phone, color, salary_rate, is_active, created_at FROM employees WHERE tenant_id = ${tenantId} ORDER BY name`,
        txn`SELECT id, name, email, phone, notes, created_at FROM clients WHERE tenant_id = ${tenantId} ORDER BY name`,
        txn`SELECT id, name, description, default_price, duration_minutes, is_variable_price, display_order, is_active, created_at FROM services WHERE tenant_id = ${tenantId} ORDER BY display_order, name`,
        txn`
          SELECT
            a.id, a.client_id, a.employee_id, a.start_time, a.status,
            a.booked_by, a.notes, a.created_at,
            c.name AS passenger_name, c.phone AS passenger_phone, c.email AS passenger_email,
            e.name AS driver_name
          FROM appointments a
          LEFT JOIN clients c ON a.client_id = c.id
          LEFT JOIN employees e ON a.employee_id = e.id
          WHERE a.tenant_id = ${tenantId}
          ORDER BY a.start_time DESC
        `,
        txn`
          SELECT
            ap_s.id, ap_s.appointment_id, ap_s.service_id, ap_s.service_price,
            ap_s.duration_minutes, ap_s.quantity,
            s.name AS service_name
          FROM appointment_services ap_s
          JOIN appointments a ON ap_s.appointment_id = a.id
          LEFT JOIN services s ON ap_s.service_id = s.id
          WHERE a.tenant_id = ${tenantId}
          ORDER BY ap_s.appointment_id
        `,
        txn`
          SELECT id, appointment_id, category, method, amount, tip_amount,
                 description, transaction_date, created_at
          FROM transactions
          WHERE tenant_id = ${tenantId}
          ORDER BY transaction_date DESC
        `,
        txn`
          SELECT r.id, r.client_id, r.employee_id, r.start_time, r.frequency,
                 r.notes, r.created_at,
                 c.name AS passenger_name, e.name AS driver_name
          FROM recurring_appointments r
          LEFT JOIN clients c ON r.client_id = c.id
          LEFT JOIN employees e ON r.employee_id = e.id
          WHERE r.tenant_id = ${tenantId}
        `,
        txn`
          SELECT wh.id, wh.employee_id, wh.day_of_week, wh.start_time, wh.end_time,
                 e.name AS driver_name
          FROM working_hours wh
          JOIN employees e ON wh.employee_id = e.id
          WHERE e.tenant_id = ${tenantId}
          ORDER BY wh.employee_id, wh.day_of_week
        `,
        txn`
          SELECT bt.id, bt.employee_id, bt.start_time, bt.end_time, bt.reason,
                 e.name AS driver_name
          FROM blocked_times bt
          JOIN employees e ON bt.employee_id = e.id
          WHERE e.tenant_id = ${tenantId}
          ORDER BY bt.start_time
        `,
        txn`SELECT key, value FROM settings WHERE tenant_id = ${tenantId}`,
      ]);
      console.log("[Export] Database queries completed successfully");
    } catch (dbError) {
      console.error("[Export] Database query error:", dbError);
      throw new Error(`Database query failed: ${dbError.message}`);
    }

    const [
      tenants,
      employees,
      clients,
      services,
      appointments,
      appointmentServices,
      transactions,
      recurringAppointments,
      workingHours,
      blockedTimes,
      settings,
    ] = queryResults;

    console.log("[Export] Processing data...");
    console.log(
      `[Export] Found: ${employees.length} drivers, ${clients.length} passengers, ${appointments.length} trips`,
    );

    // Build settings map (exclude sensitive keys)
    const sensitiveKeys = new Set([
      "quo_api_key",
      "sms_api_key",
      "quo_webhook_secret",
    ]);
    const settingsMap = settings.reduce((acc, { key, value }) => {
      if (!sensitiveKeys.has(key)) acc[key] = value;
      return acc;
    }, {});

    // Group appointment services by appointment id for easy lookup
    const servicesByApptId = appointmentServices.reduce((acc, s) => {
      if (!acc[s.appointment_id]) acc[s.appointment_id] = [];
      acc[s.appointment_id].push({
        id: s.id,
        service_id: s.service_id,
        service_name: s.service_name,
        service_price: Number(s.service_price),
        duration_minutes: s.duration_minutes,
        quantity: s.quantity,
      });
      return acc;
    }, {});

    const payload = {
      export_version: "1.0",
      exported_at: new Date().toISOString(),
      app: "LimoService",
      tenant: tenants[0] || null,

      drivers: employees.map((e) => ({
        id: e.id,
        name: e.name,
        email: e.email,
        phone: e.phone,
        color: e.color,
        salary_rate: Number(e.salary_rate),
        is_active: e.is_active,
        created_at: e.created_at,
      })),

      passengers: clients.map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        notes: c.notes,
        created_at: c.created_at,
      })),

      services: services.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        default_price: Number(s.default_price),
        duration_minutes: s.duration_minutes,
        is_variable_price: s.is_variable_price,
        display_order: s.display_order,
        is_active: s.is_active,
        created_at: s.created_at,
      })),

      trips: appointments.map((a) => ({
        id: a.id,
        client_id: a.client_id,
        passenger_name: a.passenger_name,
        passenger_phone: a.passenger_phone,
        passenger_email: a.passenger_email,
        employee_id: a.employee_id,
        driver_name: a.driver_name,
        start_time: a.start_time,
        status: a.status,
        booked_by: a.booked_by,
        notes: a.notes,
        created_at: a.created_at,
        services: servicesByApptId[a.id] || [],
      })),

      transactions: transactions.map((t) => ({
        id: t.id,
        appointment_id: t.appointment_id,
        category: t.category,
        method: t.method,
        amount: Number(t.amount),
        tip_amount: Number(t.tip_amount),
        description: t.description,
        transaction_date: t.transaction_date,
        created_at: t.created_at,
      })),

      recurring_trips: recurringAppointments.map((r) => ({
        id: r.id,
        client_id: r.client_id,
        passenger_name: r.passenger_name,
        employee_id: r.employee_id,
        driver_name: r.driver_name,
        start_time: r.start_time,
        frequency: r.frequency,
        notes: r.notes,
        created_at: r.created_at,
      })),

      working_hours: workingHours.map((w) => ({
        id: w.id,
        employee_id: w.employee_id,
        driver_name: w.driver_name,
        day_of_week: w.day_of_week,
        start_time: w.start_time,
        end_time: w.end_time,
      })),

      blocked_times: blockedTimes.map((b) => ({
        id: b.id,
        employee_id: b.employee_id,
        driver_name: b.driver_name,
        start_time: b.start_time,
        end_time: b.end_time,
        reason: b.reason,
      })),

      settings: settingsMap,
    };

    console.log("[Export] Data processing complete, generating JSON...");

    let jsonString;
    try {
      jsonString = JSON.stringify(payload, null, 2);
      console.log(
        `[Export] JSON generated successfully (${(jsonString.length / 1024).toFixed(2)} KB)`,
      );
    } catch (jsonError) {
      console.error("[Export] JSON stringify error:", jsonError);
      throw new Error(`Failed to generate JSON: ${jsonError.message}`);
    }

    return new Response(jsonString, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="limoservice-export-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (error) {
    console.error("[Export] Error:", error);
    console.error("[Export] Error stack:", error.stack);
    return Response.json(
      {
        error: "Export failed: " + error.message,
        details: error.stack,
      },
      { status: 500 },
    );
  }
}
