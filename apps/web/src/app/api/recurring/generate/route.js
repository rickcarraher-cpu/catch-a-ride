import sql from "@/app/api/utils/sql";
import { insertAppointmentWithBookingNumber } from "@/app/api/utils/booking-number";
import { createDateInCDT, getDatePartsInCDT } from "@/utils/timezone";

// Generate appointments from recurring series
// This should be called daily via cron or manually triggered
export async function POST(request) {
  try {
    const { days_ahead = 30, recurring_id = null } = await request.json();

    // Fetch recurring series to process
    let recurringSeries;
    if (recurring_id) {
      recurringSeries = await sql`
        SELECT * FROM recurring_appointments
        WHERE id = ${recurring_id} AND tenant_id = 1
          AND (is_deleted = false OR is_deleted IS NULL)
      `;
    } else {
      recurringSeries = await sql`
        SELECT * FROM recurring_appointments
        WHERE tenant_id = 1
          AND (is_deleted = false OR is_deleted IS NULL)
      `;
    }

    console.log(
      `[Recurring Gen] Processing ${recurringSeries.length} series...`,
    );

    const now = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days_ahead);
    endDate.setHours(23, 59, 59, 999); // Include the entire last day

    let generatedCount = 0;
    const errors = [];

    for (const series of recurringSeries) {
      try {
        // If num_occurrences is set (> 0), check how many have already been generated
        let remainingSlots = Infinity;
        if (series.num_occurrences && series.num_occurrences > 0) {
          // Count only appointments that match this series' time-of-day
          // This prevents appointments from other recurring series (e.g. daily at 08:30)
          // from counting against this series (e.g. weekly at 09:00)
          const countResult = await sql`
            SELECT COUNT(*)::int as total FROM appointments
            WHERE client_id = ${series.client_id}
            AND booked_by = 'Recurring'
            AND tenant_id = 1
            AND start_time >= ${series.created_at}
            AND to_char(start_time, 'HH24:MI') = ${series.start_time.substring(0, 5)}
          `;
          const alreadyGenerated = countResult[0]?.total || 0;
          remainingSlots = series.num_occurrences - alreadyGenerated;
          if (remainingSlots <= 0) continue; // Already hit the limit
        }

        const appointments = generateAppointmentsFromSeries(
          series,
          now,
          endDate,
          remainingSlots,
        );

        for (const apt of appointments) {
          // Check if appointment already exists at this exact time
          const existing = await sql`
            SELECT id FROM appointments
            WHERE client_id = ${series.client_id}
            AND start_time = ${apt.start_time}
            AND tenant_id = 1
          `;

          if (existing.length === 0) {
            // Clone all template fields from the recurring series
            const appointment = await insertAppointmentWithBookingNumber({
              client_id: series.client_id,
              employee_id: series.employee_id || null,
              start_time: apt.start_time,
              status: "confirmed",
              booked_by: "Recurring",
              booker_name: null,
              notes: series.notes || "Auto-generated from recurring series",
              vehicle_id: series.vehicle_id || null,
              destination: series.destination || null,
              num_people: series.num_people || null,
              num_bags_checked: series.num_bags_checked || null,
              num_bags_carry_on: series.num_bags_carry_on || null,
              outgoing_flight_info: series.outgoing_flight_info || null,
              returning_flight_info: series.returning_flight_info || null,
              return_date: series.return_date || null,
              driver_notes: series.driver_notes || null,
              is_tentative: series.is_tentative || false,
              tentative_reason: series.tentative_reason || null,
              payment_method: series.payment_method || null,
              requested_driver_name: series.requested_driver_name || null,
            });

            // Clone services from the template
            if (
              series.services_data &&
              Array.isArray(series.services_data) &&
              series.services_data.length > 0
            ) {
              for (const svc of series.services_data) {
                await sql`
                  INSERT INTO appointment_services (
                    appointment_id, service_id, service_price, duration_minutes, quantity
                  )
                  VALUES (
                    ${appointment.id}, ${svc.service_id}, ${svc.service_price}, 
                    ${svc.duration_minutes}, ${svc.quantity || 1}
                  )
                `;
              }
            }

            generatedCount++;
            remainingSlots--;
            if (remainingSlots <= 0) break;
          }
        }
      } catch (error) {
        console.error(
          `[Recurring Gen] Error series ${series.id}: ${error.message}`,
        );
        errors.push({ series_id: series.id, error: error.message });
      }
    }

    console.log(
      `[Recurring Gen] Completed: ${generatedCount} appointments created, ${errors.length} errors`,
    );

    // Return minimal response for cron (detailed info in server logs)
    return Response.json({ success: true });
  } catch (error) {
    console.error("[Recurring Gen] Error:", error.message);
    return Response.json({ success: false }, { status: 500 });
  }
}

export async function GET() {
  return Response.json({
    ok: true,
    endpoint: "recurring/generate",
    method: "POST",
  });
}

function generateAppointmentsFromSeries(series, startDate, endDate, maxCount) {
  const appointments = [];
  const [hours, minutes] = series.start_time.split(":").map(Number);

  // Get current date in CDT
  const startParts = getDatePartsInCDT(startDate);
  let currentDate = createDateInCDT(
    parseInt(startParts.year),
    parseInt(startParts.month),
    parseInt(startParts.day),
    hours,
    minutes,
  );

  // If the time today has passed, start from tomorrow
  if (currentDate < startDate) {
    const nextDay = new Date(currentDate);
    nextDay.setDate(nextDay.getDate() + 1);
    const nextParts = getDatePartsInCDT(nextDay);
    currentDate = createDateInCDT(
      parseInt(nextParts.year),
      parseInt(nextParts.month),
      parseInt(nextParts.day),
      hours,
      minutes,
    );
  }

  // Use explicit day_of_week if set, otherwise fall back to created_at day
  const seriesStartDate = new Date(series.created_at);
  const targetDayOfWeek =
    series.day_of_week != null
      ? series.day_of_week
      : new Date(
          seriesStartDate.toLocaleString("en-US", {
            timeZone: "America/Chicago",
          }),
        ).getDay();
  const targetDayOfMonth = parseInt(getDatePartsInCDT(seriesStartDate).day);

  while (currentDate <= endDate && appointments.length < maxCount) {
    let shouldInclude = false;
    const currentParts = getDatePartsInCDT(currentDate);
    const currentDayOfWeek = new Date(
      currentDate.toLocaleString("en-US", { timeZone: "America/Chicago" }),
    ).getDay();

    switch (series.frequency) {
      case "daily":
        shouldInclude = true;
        break;

      case "weekly":
        // Only on the same day of week the series was created
        shouldInclude = currentDayOfWeek === targetDayOfWeek;
        break;

      case "bi-weekly": {
        // Same day of week AND every other week from the series start
        if (currentDayOfWeek === targetDayOfWeek) {
          const daysSinceStart = Math.round(
            (currentDate - seriesStartDate) / (1000 * 60 * 60 * 24),
          );
          const weeksSinceStart = Math.round(daysSinceStart / 7);
          shouldInclude = weeksSinceStart % 2 === 0;
        }
        break;
      }

      case "monthly":
        // Same day of month as when the series was created
        shouldInclude = parseInt(currentParts.day) === targetDayOfMonth;
        break;
    }

    if (shouldInclude) {
      appointments.push({
        start_time: currentDate.toISOString(),
      });
    }

    // Move to next day in CDT
    const nextDay = new Date(currentDate);
    nextDay.setDate(nextDay.getDate() + 1);
    const nextParts = getDatePartsInCDT(nextDay);
    currentDate = createDateInCDT(
      parseInt(nextParts.year),
      parseInt(nextParts.month),
      parseInt(nextParts.day),
      hours,
      minutes,
    );
  }

  return appointments;
}
