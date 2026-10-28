import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { recalculateDriverCommission } from "@/app/api/utils/cached-calculations";

/**
 * PATCH /api/appointments/[id]/commission-rate
 * Body: { rate: 0.80 }  ← decimal (e.g. 0.80 = 80%)
 *       or { rate_percent: 80 } ← integer percentage
 *
 * Sets a trip-specific commission rate override (trip_commission_rate).
 * Recalculates driver_commission immediately using the new rate.
 * Also updates the Commission expense transaction if the trip is paid.
 */
export async function PATCH(request, { params }) {
  const { id } = params;
  try {
    const session = await auth();
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Accept either decimal (0.80) or integer percent (80)
    let rate;
    if (body.rate_percent !== undefined) {
      rate = Number(body.rate_percent) / 100;
    } else if (body.rate !== undefined) {
      rate = Number(body.rate);
    } else {
      return Response.json(
        { error: "Missing rate or rate_percent" },
        { status: 400 },
      );
    }

    if (isNaN(rate) || rate < 0 || rate > 1) {
      return Response.json(
        { error: "Rate must be between 0 and 1 (or 0–100 as percent)" },
        { status: 400 },
      );
    }

    // Fetch the trip
    const [trip] = await sql`
      SELECT id, employee_id, payment_status, booking_number, services_total
      FROM appointments WHERE id = ${id} AND tenant_id = 1
    `;
    if (!trip) {
      return Response.json({ error: "Trip not found" }, { status: 404 });
    }

    // Save the trip-level rate override
    await sql`
      UPDATE appointments
      SET trip_commission_rate = ${rate}
      WHERE id = ${id}
    `;

    console.log(
      `[CommissionRate] Trip #${id}: trip_commission_rate set to ${(rate * 100).toFixed(1)}% by ${session.user?.email}`,
    );

    // Recalculate driver_commission using new rate
    const newCommission = await recalculateDriverCommission(id);

    // If trip is paid, also update the commission expense transaction
    if (trip.payment_status === "paid" && trip.employee_id) {
      try {
        const [driver] = await sql`
          SELECT id, name FROM employees WHERE id = ${trip.employee_id}
        `;
        if (driver) {
          const tripRef = trip.booking_number || `#${id}`;
          const desc = `Commission for ${driver.name} (${Math.round(rate * 100)}%${body.rate_percent !== undefined || body.rate !== undefined ? " — override" : ""}) — Trip ${tripRef}`;
          const existing = await sql`
            SELECT id FROM transactions
            WHERE appointment_id = ${id}
              AND category = 'expense'
              AND method = 'Commission'
            ORDER BY id ASC
            LIMIT 1
          `;
          if (existing.length > 0) {
            await sql`
              UPDATE transactions
              SET amount = ${newCommission}, description = ${desc}
              WHERE id = ${existing[0].id}
            `;
            console.log(
              `[CommissionRate] Trip #${id}: updated commission transaction to $${newCommission}`,
            );
          }
        }
      } catch (txnErr) {
        console.error(
          `[CommissionRate] Trip #${id}: failed to update commission transaction:`,
          txnErr.message,
        );
      }
    }

    return Response.json({
      success: true,
      trip_commission_rate: rate,
      driver_commission: newCommission,
    });
  } catch (error) {
    console.error("[CommissionRate] Error:", error);
    return Response.json(
      { error: error.message || "Failed to update commission rate" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/appointments/[id]/commission-rate
 * Removes the trip-level rate override (reverts to driver's default salary_rate).
 */
export async function DELETE(request, { params }) {
  const { id } = params;
  try {
    const session = await auth();
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [trip] = await sql`
      SELECT id, employee_id, payment_status, booking_number, services_total
      FROM appointments WHERE id = ${id} AND tenant_id = 1
    `;
    if (!trip) {
      return Response.json({ error: "Trip not found" }, { status: 404 });
    }

    // Remove the override
    await sql`
      UPDATE appointments SET trip_commission_rate = NULL WHERE id = ${id}
    `;

    console.log(
      `[CommissionRate] Trip #${id}: trip_commission_rate cleared (reverted to driver default) by ${session.user?.email}`,
    );

    // Recalculate using driver's default rate
    const newCommission = await recalculateDriverCommission(id);

    return Response.json({
      success: true,
      trip_commission_rate: null,
      driver_commission: newCommission,
    });
  } catch (error) {
    console.error("[CommissionRate] Error:", error);
    return Response.json(
      { error: error.message || "Failed to clear commission rate" },
      { status: 500 },
    );
  }
}
