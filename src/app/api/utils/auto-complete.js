import sql from "@/app/api/utils/sql";
import { resolveTenantFromAppointment } from "@/app/api/utils/tenant-resolver";

/**
 * Auto-complete a trip if:
 * 1. Trip date/time has passed
 * 2. Payment has been received (payment_status = 'paid')
 *
 * This helper is called after payment is confirmed to immediately transition
 * the trip to completed status if the date has passed.
 *
 * @param {number} appointmentId - The appointment ID
 * @param {number} [tenantId] - Optional tenant ID (will be resolved from appointment if not provided)
 */
export async function autoCompleteIfEligible(appointmentId, tenantId = null) {
  try {
    // Resolve tenant from appointment if not provided
    const resolvedTenantId =
      tenantId || (await resolveTenantFromAppointment(appointmentId));

    const [trip] = await sql`
      SELECT id, status, payment_status, start_time, booking_number
      FROM appointments
      WHERE id = ${appointmentId}
      AND tenant_id = ${resolvedTenantId}
    `;

    if (!trip) {
      console.log(
        `[Auto-Complete:tenant${resolvedTenantId}] Trip #${appointmentId} not found`,
      );
      return { completed: false, reason: "not_found" };
    }

    // Only complete trips that are in active statuses (not already completed, cancelled, or deleted)
    const eligibleStatuses = [
      "pending",
      "confirmed",
      "needs_review",
      "link_created",
    ];
    if (!eligibleStatuses.includes(trip.status)) {
      console.log(
        `[Auto-Complete:tenant${resolvedTenantId}] Trip #${appointmentId} status is "${trip.status}" - not eligible for auto-completion`,
      );
      return { completed: false, reason: "ineligible_status" };
    }

    // Check if trip is paid
    const isPaid = trip.payment_status === "paid";
    if (!isPaid) {
      console.log(
        `[Auto-Complete:tenant${resolvedTenantId}] Trip #${appointmentId} is not paid (status: ${trip.payment_status})`,
      );
      return { completed: false, reason: "not_paid" };
    }

    // Check if trip date has passed
    const tripDate = new Date(trip.start_time);
    const now = new Date();
    const hasPassed = tripDate < now;

    if (!hasPassed) {
      console.log(
        `[Auto-Complete:tenant${resolvedTenantId}] Trip #${appointmentId} date has not passed yet (scheduled for ${tripDate.toISOString()})`,
      );
      return { completed: false, reason: "future_trip" };
    }

    // Trip is eligible - mark as completed
    await sql`
      UPDATE appointments
      SET status = 'completed'
      WHERE id = ${appointmentId}
      AND tenant_id = ${resolvedTenantId}
    `;

    console.log(
      `[Auto-Complete:tenant${resolvedTenantId}] ✅ Trip #${trip.booking_number || appointmentId} marked as completed (paid + date passed)`,
    );

    return { completed: true, reason: "eligible" };
  } catch (error) {
    console.error(
      `[Auto-Complete] Error for trip #${appointmentId}:`,
      error.message,
    );
    return { completed: false, reason: "error", error: error.message };
  }
}

/**
 * Batch auto-complete all old paid trips for all tenants
 * Used by the scheduled cron job
 */
export async function autoCompleteOldTrips() {
  try {
    // Process all tenants
    const result = await sql`
      UPDATE appointments
      SET status = 'completed'
      WHERE status NOT IN ('completed', 'cancelled', 'deleted')
        AND payment_status = 'paid'
        AND start_time < NOW()
      RETURNING id, tenant_id, booking_number, start_time
    `;

    if (result.length > 0) {
      console.log(
        `[Auto-Complete Batch] ✅ Completed ${result.length} old paid trips across all tenants:`,
      );

      // Group by tenant for better logging
      const byTenant = result.reduce((acc, trip) => {
        if (!acc[trip.tenant_id]) acc[trip.tenant_id] = [];
        acc[trip.tenant_id].push(trip);
        return acc;
      }, {});

      for (const [tenantId, trips] of Object.entries(byTenant)) {
        console.log(`  Tenant ${tenantId}: ${trips.length} trips`);
        trips.forEach((trip) => {
          console.log(
            `    - Trip #${trip.booking_number || trip.id} (date: ${new Date(trip.start_time).toLocaleDateString()})`,
          );
        });
      }
    } else {
      console.log(`[Auto-Complete Batch] No trips to auto-complete`);
    }

    return {
      success: true,
      count: result.length,
      trips: result.map((t) => ({
        id: t.id,
        tenant_id: t.tenant_id,
        booking_number: t.booking_number,
        date: t.start_time,
      })),
    };
  } catch (error) {
    console.error(`[Auto-Complete Batch] Error:`, error.message);
    return { success: false, error: error.message };
  }
}
