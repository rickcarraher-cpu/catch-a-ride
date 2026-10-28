import sql from "@/app/api/utils/sql";
import { sendWeddingNotification } from "../notify";

// GET /api/weddings-2/[id] — fetch a single booking
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const [booking] =
      await sql`SELECT * FROM wedding_bookings_2 WHERE id = ${Number(id)} LIMIT 1`;
    if (!booking) {
      return Response.json(
        { error: "Wedding booking not found" },
        { status: 404 },
      );
    }
    return Response.json(booking);
  } catch (error) {
    console.error("[Weddings2] Get error:", error);
    return Response.json(
      { error: "Failed to fetch wedding booking" },
      { status: 500 },
    );
  }
}

// PATCH /api/weddings-2/[id] — update booking (admin edits, status changes, notifications)
export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const bookingId = Number(id);
    const body = await request.json();

    const [existing] =
      await sql`SELECT * FROM wedding_bookings_2 WHERE id = ${bookingId} LIMIT 1`;
    if (!existing) {
      return Response.json(
        { error: "Wedding booking not found" },
        { status: 404 },
      );
    }

    const {
      wedding_date,
      ceremony_time,
      ceremony_address,
      ceremony_venue_name,
      reception_same_as_ceremony,
      reception_time,
      reception_address,
      reception_venue_name,
      vehicles_needed,
      vehicles_not_sure,
      estimated_passengers,
      primary_contact_name,
      primary_contact_phone,
      contact_preference,
      contact_email,
      status,
      pricing_type,
      estimated_price,
      driver_name,
      driver_photo_url,
      vehicle_details,
      send_notification, // optional: fire a notification on this update
    } = body;

    // Build dynamic update
    const setClauses = [];
    const values = [];
    const add = (col, val) => {
      values.push(val);
      setClauses.push(`${col} = $${values.length}`);
    };

    if (wedding_date !== undefined) add("wedding_date", wedding_date);
    if (ceremony_time !== undefined) add("ceremony_time", ceremony_time);
    if (ceremony_address !== undefined)
      add("ceremony_address", ceremony_address);
    if (ceremony_venue_name !== undefined)
      add("ceremony_venue_name", ceremony_venue_name);
    if (reception_same_as_ceremony !== undefined)
      add("reception_same_as_ceremony", reception_same_as_ceremony === true);
    if (reception_time !== undefined) add("reception_time", reception_time);
    if (reception_address !== undefined)
      add("reception_address", reception_address);
    if (reception_venue_name !== undefined)
      add("reception_venue_name", reception_venue_name);
    if (vehicles_needed !== undefined)
      add(
        "vehicles_needed",
        vehicles_needed === null ? null : Number(vehicles_needed),
      );
    if (vehicles_not_sure !== undefined)
      add("vehicles_not_sure", vehicles_not_sure === true);
    if (estimated_passengers !== undefined)
      add(
        "estimated_passengers",
        estimated_passengers === null ? null : Number(estimated_passengers),
      );
    if (primary_contact_name !== undefined)
      add("primary_contact_name", primary_contact_name);
    if (primary_contact_phone !== undefined)
      add("primary_contact_phone", primary_contact_phone);
    if (contact_preference !== undefined)
      add("contact_preference", contact_preference);
    if (contact_email !== undefined) add("contact_email", contact_email);
    if (status !== undefined) {
      add("status", status);
      // Track lifecycle timestamps
      if (status === "deposit_paid") add("deposit_paid_at", new Date());
      if (status === "confirmed") add("confirmed_at", new Date());
      if (status === "completed") add("completed_at", new Date());
    }
    if (pricing_type !== undefined) add("pricing_type", pricing_type);
    if (estimated_price !== undefined)
      add(
        "estimated_price",
        estimated_price === null ? 0 : Number(estimated_price),
      );
    if (driver_name !== undefined) add("driver_name", driver_name);
    if (driver_photo_url !== undefined)
      add("driver_photo_url", driver_photo_url);
    if (vehicle_details !== undefined) add("vehicle_details", vehicle_details);

    if (setClauses.length === 0 && !send_notification) {
      return Response.json({ error: "Nothing to update" }, { status: 400 });
    }

    let updated = existing;
    if (setClauses.length > 0) {
      values.push(bookingId);
      updated = await sql(
        `UPDATE wedding_bookings_2 SET ${setClauses.join(", ")}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`,
        values,
      );
      updated = updated[0];
    }

    // Optionally fire a notification (e.g. quote_ready, driver_assigned, day_before_reminder, thank_you)
    let notified = null;
    if (send_notification) {
      notified = await sendWeddingNotification(updated, send_notification);
    }

    return Response.json({ success: true, booking: updated, notified });
  } catch (error) {
    console.error("[Weddings2] Update error:", error);
    return Response.json(
      { error: "Failed to update wedding booking" },
      { status: 500 },
    );
  }
}

// DELETE /api/weddings-2/[id] — remove a booking
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    await sql`DELETE FROM wedding_bookings_2 WHERE id = ${Number(id)}`;
    return Response.json({ success: true });
  } catch (error) {
    console.error("[Weddings2] Delete error:", error);
    return Response.json(
      { error: "Failed to delete wedding booking" },
      { status: 500 },
    );
  }
}
