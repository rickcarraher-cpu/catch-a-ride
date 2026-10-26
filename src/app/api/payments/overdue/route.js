import sql from "@/app/api/utils/sql";

/**
 * GET /api/payments/overdue
 * Returns all unpaid trips based on payment_status field (not 'paid').
 * No date restriction — shows past, present, and future unpaid trips.
 *
 * Query params:
 *   driver_id       — filter by driver
 *   payment_method  — filter by payment method
 *   show_all        — if 'true', show all trips (paid and unpaid)
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const driverId = searchParams.get("driver_id");
    const paymentMethodFilter = searchParams.get("payment_method");
    const showAll = searchParams.get("show_all") === "true";

    // Build filters — ONLY criteria is payment_status != 'paid'.
    // Any trip not explicitly marked paid appears. No other restriction.
    let filters = `
      WHERE a.tenant_id = 1
      AND LOWER(a.status) NOT IN ('deleted', 'cancelled')
    `;

    // Only show unpaid trips unless show_all is requested
    // A trip belongs on the report if its payment_status is anything other than 'paid'
    if (!showAll) {
      filters += `
        AND a.payment_status != 'paid'
      `;
    }

    const params = [];

    if (driverId) {
      params.push(driverId);
      filters += ` AND a.employee_id = $${params.length}`;
    }

    if (paymentMethodFilter) {
      if (paymentMethodFilter === "Credit Card") {
        // Match both 'Credit Card' and 'Square'
        filters += ` AND (a.payment_method = 'Credit Card' OR a.payment_method = 'Square')`;
      } else {
        params.push(paymentMethodFilter);
        filters += ` AND a.payment_method = $${params.length}`;
      }
    }

    // Always sort by trip date
    const orderBy = "a.start_time ASC";

    // Single query with subqueries for services, payment link, sent messages, and totals
    const fullQuery = `
      SELECT 
        a.id,
        a.client_id,
        a.booking_number,
        a.start_time,
        a.status,
        a.payment_status,
        CASE 
          WHEN a.payment_method = 'Square' THEN 'Square Invoice'
          WHEN a.payment_method IS NULL OR a.payment_method = '' THEN 'Not Specified'
          ELSE a.payment_method 
        END AS payment_method,
        a.created_at,
        a.destination,
        a.notes,
        a.num_people,
        c.name AS client_name,
        c.phone AS client_phone,
        c.email AS client_email,
        c.notification_preference AS client_notification_preference,
        e.name AS employee_name,
        e.color AS employee_color,
        v.name AS vehicle_name,
        ROUND(EXTRACT(EPOCH FROM (NOW() - a.created_at)) / 3600) AS hours_since_created,
        ROUND(EXTRACT(EPOCH FROM (NOW() - a.start_time)) / 3600) AS hours_since_trip,
        COALESCE(a.original_amount, 0) AS original_amount,
        COALESCE(a.payments_total, 0) AS payments_total,
        COALESCE(a.balance_due, 0) AS balance_due,
        -- Past due: rounded balance remaining AND trip was before last night's midnight CDT
        (ROUND(COALESCE(a.balance_due, 0)::numeric, 2) > 0 AND a.start_time < (DATE_TRUNC('day', NOW() AT TIME ZONE 'America/Chicago') AT TIME ZONE 'America/Chicago')) AS is_past_due,
        (SELECT json_agg(json_build_object(
           'name', s.name,
           'price', aserv.service_price,
           'quantity', aserv.quantity,
           'is_addon', s.is_addon
         ))
         FROM appointment_services aserv
         JOIN services s ON aserv.service_id = s.id
         WHERE aserv.appointment_id = a.id
        ) AS services,
        (SELECT row_to_json(sub)
         FROM (
           SELECT p.id, p.provider, p.status, p.payment_url, p.created_at
           FROM payments p
           WHERE p.appointment_id = a.id
           AND p.status IN ('pending', 'link_created')
           ORDER BY p.created_at DESC
           LIMIT 1
         ) sub
        ) AS active_payment_link,
        (SELECT json_agg(json_build_object(
           'id', sm.id,
           'message', sm.message,
           'sent_at', sm.sent_at,
           'direction', sm.direction
         ) ORDER BY sm.sent_at DESC)
         FROM sms_messages sm
         WHERE sm.appointment_id = a.id
         AND sm.direction = 'outbound'
        ) AS sent_messages
      FROM appointments a
      LEFT JOIN clients c ON a.client_id = c.id
      LEFT JOIN employees e ON a.employee_id = e.id
      LEFT JOIN vehicles v ON a.vehicle_id = v.id
      ${filters}
      ORDER BY ${orderBy}
    `;

    const results = await sql(fullQuery, params);

    // Compute summary stats
    const totalUnpaid = showAll
      ? results.filter((r) => Number(r.balance_due || 0) > 0).length
      : results.length; // NEW: When showing all, count only unpaid for this stat
    const totalAmountDue = results.reduce(
      (sum, r) => sum + Number(r.balance_due || 0),
      0,
    );
    // Past due = balance remaining AND trip was before last night's midnight CDT
    const pastDueResults = results.filter(
      (r) =>
        r.is_past_due === true ||
        r.is_past_due === "t" ||
        r.is_past_due === "true",
    );
    const pastDueCount = pastDueResults.length;
    const pastDueAmount = pastDueResults.reduce(
      (sum, r) => sum + Number(r.balance_due || 0),
      0,
    );
    const over48h = results.filter(
      (r) => Number(r.hours_since_trip) > 48 && Number(r.balance_due || 0) > 0,
    ).length;
    const over72h = results.filter(
      (r) => Number(r.hours_since_trip) > 72 && Number(r.balance_due || 0) > 0,
    ).length;
    const withPaymentLink = results.filter(
      (r) => r.active_payment_link && Number(r.balance_due || 0) > 0,
    ).length;
    const withoutPaymentLink = totalUnpaid - withPaymentLink;

    // Group by payment method (already normalized in query — Square → Credit Card)
    const byMethod = {};
    results.forEach((r) => {
      if (Number(r.balance_due || 0) <= 0 && !showAll) return; // Skip paid trips in unpaid mode
      const method = r.payment_method || "Unspecified";
      if (!byMethod[method]) byMethod[method] = { count: 0, amount: 0 };
      byMethod[method].count += 1;
      byMethod[method].amount += Number(r.balance_due || 0);
    });

    // Group by driver
    const byDriver = {};
    results.forEach((r) => {
      if (Number(r.balance_due || 0) <= 0 && !showAll) return; // Skip paid trips in unpaid mode
      const driver = r.employee_name || "Unassigned";
      if (!byDriver[driver])
        byDriver[driver] = { count: 0, amount: 0, color: r.employee_color };
      byDriver[driver].count += 1;
      byDriver[driver].amount += Number(r.balance_due || 0);
    });

    return Response.json({
      summary: {
        total_unpaid: totalUnpaid,
        total_amount_due: totalAmountDue,
        past_due_count: pastDueCount,
        past_due_amount: pastDueAmount,
        over_48h: over48h,
        over_72h: over72h,
        with_payment_link: withPaymentLink,
        without_payment_link: withoutPaymentLink,
        by_method: byMethod,
        by_driver: byDriver,
      },
      trips: results.map((r) => ({
        ...r,
        original_amount: Number(r.original_amount || 0),
        payments_total: Number(r.payments_total || 0),
        balance_due: Number(r.balance_due || 0),
        hours_since_created: Number(r.hours_since_created || 0),
        hours_since_trip: Number(r.hours_since_trip || 0),
        is_past_due:
          r.is_past_due === true ||
          r.is_past_due === "t" ||
          r.is_past_due === "true",
      })),
    });
  } catch (error) {
    console.error("Failed to fetch overdue payments:", error);
    return Response.json(
      { error: "Failed to fetch overdue payments", details: error.message },
      { status: 500 },
    );
  }
}
