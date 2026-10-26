import sql from "@/app/api/utils/sql";
import { sendConfirmations } from "@/app/api/utils/confirmations/confirmationService";

/**
 * Repair endpoint: finds trips that have a driver assigned but were never notified
 * (i.e. driver_confirmation_token is NULL despite having employee_id)
 *
 * Two modes:
 * - GET: Preview how many trips would be affected
 * - POST: Actually repair them (notify + set token, or optionally unassign)
 */

export async function GET(request) {
  try {
    // Find trips with driver but no confirmation token
    const orphanedTrips = await sql`
      SELECT 
        a.id,
        a.booking_number,
        a.start_time,
        a.employee_id,
        e.name as driver_name,
        c.name as passenger_name,
        a.status
      FROM appointments a
      LEFT JOIN employees e ON a.employee_id = e.id
      LEFT JOIN clients c ON a.client_id = c.id
      WHERE a.employee_id IS NOT NULL
        AND a.driver_confirmation_token IS NULL
        AND a.status != 'cancelled'
        AND a.status != 'canceled'
        AND a.start_time >= CURRENT_DATE - INTERVAL '30 days'
      ORDER BY a.start_time ASC
    `;

    return Response.json({
      success: true,
      count: orphanedTrips.length,
      trips: orphanedTrips.map((t) => ({
        id: t.id,
        booking_number: t.booking_number,
        start_time: t.start_time,
        driver_name: t.driver_name,
        passenger_name: t.passenger_name,
        status: t.status,
      })),
    });
  } catch (error) {
    console.error("[repair-orphaned] Preview failed:", error);
    return Response.json(
      { error: "Failed to preview orphaned assignments" },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    const { action = "notify", tripIds = null } = await request.json();

    // action: "notify" (send confirmations + set token) or "unassign" (remove driver)
    // tripIds: optional array of specific trip IDs to repair (null = all orphaned)

    let orphanedTrips;

    if (tripIds && Array.isArray(tripIds) && tripIds.length > 0) {
      // Repair specific trips
      orphanedTrips = await sql`
        SELECT 
          a.id,
          a.booking_number,
          a.employee_id,
          e.name as driver_name
        FROM appointments a
        LEFT JOIN employees e ON a.employee_id = e.id
        WHERE a.id = ANY(${tripIds})
          AND a.employee_id IS NOT NULL
          AND a.driver_confirmation_token IS NULL
          AND a.status != 'cancelled'
          AND a.status != 'canceled'
      `;
    } else {
      // Find all orphaned trips (last 30 days)
      orphanedTrips = await sql`
        SELECT 
          a.id,
          a.booking_number,
          a.employee_id,
          e.name as driver_name
        FROM appointments a
        LEFT JOIN employees e ON a.employee_id = e.id
        WHERE a.employee_id IS NOT NULL
          AND a.driver_confirmation_token IS NULL
          AND a.status != 'cancelled'
          AND a.status != 'canceled'
          AND a.start_time >= CURRENT_DATE - INTERVAL '30 days'
        ORDER BY a.start_time ASC
      `;
    }

    if (orphanedTrips.length === 0) {
      return Response.json({
        success: true,
        message: "No orphaned assignments found",
        repaired: 0,
        failed: 0,
      });
    }

    let repaired = 0;
    let failed = 0;
    const results = [];

    if (action === "notify") {
      // Send confirmations and set token for each trip
      for (const trip of orphanedTrips) {
        try {
          console.log(
            `[repair-orphaned] Sending notification for trip #${trip.id} (${trip.booking_number})...`,
          );

          await sendConfirmations({
            appointmentId: trip.id,
            eventType: "driver_assigned",
            notifyPassenger: true,
            notifyDriver: true,
            notifyOffice: true,
          });

          // Notification succeeded — now set the token
          const { randomBytes } = await import("crypto");
          const token = randomBytes(32).toString("hex");

          await sql`
            UPDATE appointments
            SET 
              driver_confirmation_token = ${token},
              driver_accepted = 'pending',
              driver_response_at = NULL,
              driver_declined_reason = NULL
            WHERE id = ${trip.id}
          `;

          repaired++;
          results.push({
            trip_id: trip.id,
            booking_number: trip.booking_number,
            status: "repaired",
            action: "notified",
          });

          console.log(
            `[repair-orphaned] ✅ Repaired trip #${trip.id} — notified and set token`,
          );

          // 3s delay between notifications to respect rate limits
          if (orphanedTrips.indexOf(trip) < orphanedTrips.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 3000));
          }
        } catch (error) {
          failed++;
          results.push({
            trip_id: trip.id,
            booking_number: trip.booking_number,
            status: "failed",
            error: error.message,
          });
          console.error(
            `[repair-orphaned] ❌ Failed to repair trip #${trip.id}:`,
            error,
          );
        }
      }
    } else if (action === "unassign") {
      // Remove driver assignment for orphaned trips
      for (const trip of orphanedTrips) {
        try {
          await sql`
            UPDATE appointments
            SET 
              employee_id = NULL,
              vehicle_id = NULL,
              driver_confirmation_token = NULL,
              driver_accepted = NULL,
              driver_response_at = NULL,
              driver_declined_reason = NULL,
              status = CASE 
                WHEN status = 'confirmed' THEN 'pending'
                ELSE status
              END
            WHERE id = ${trip.id}
          `;

          repaired++;
          results.push({
            trip_id: trip.id,
            booking_number: trip.booking_number,
            status: "repaired",
            action: "unassigned",
          });

          console.log(
            `[repair-orphaned] ✅ Unassigned driver from trip #${trip.id}`,
          );
        } catch (error) {
          failed++;
          results.push({
            trip_id: trip.id,
            booking_number: trip.booking_number,
            status: "failed",
            error: error.message,
          });
          console.error(
            `[repair-orphaned] ❌ Failed to unassign trip #${trip.id}:`,
            error,
          );
        }
      }
    } else {
      return Response.json(
        { error: "Invalid action. Must be 'notify' or 'unassign'" },
        { status: 400 },
      );
    }

    return Response.json({
      success: true,
      message: `Repaired ${repaired} of ${orphanedTrips.length} orphaned assignments`,
      repaired,
      failed,
      results,
    });
  } catch (error) {
    console.error("[repair-orphaned] Repair failed:", error);
    return Response.json(
      { error: "Failed to repair orphaned assignments" },
      { status: 500 },
    );
  }
}
