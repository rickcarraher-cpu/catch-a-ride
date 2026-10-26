import sql from "@/app/api/utils/sql";
import {
  estimateWeddingPrice,
  buildSummaryText,
  sendWeddingNotification,
} from "./notify";

// Generate a unique reference code like WB-2A7K9Q
async function generateReferenceCode() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  for (let attempt = 0; attempt < 10; attempt++) {
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    const ref = `WB-${code}`;
    const existing =
      await sql`SELECT id FROM wedding_bookings_2 WHERE reference_code = ${ref} LIMIT 1`;
    if (existing.length === 0) return ref;
  }
  // Extremely unlikely fallback
  return `WB-${Date.now().toString(36).toUpperCase()}`;
}

// GET /api/weddings-2 — list bookings (admin filtered view)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const search = (searchParams.get("search") || "").trim();

    let queryStr = `SELECT * FROM wedding_bookings_2`;
    const conditions = [];
    const values = [];

    if (status && status !== "all") {
      values.push(status);
      conditions.push(`status = $${values.length}`);
    }
    if (search) {
      values.push(`%${search.toLowerCase()}%`);
      const n = values.length;
      conditions.push(
        `(LOWER(reference_code) LIKE $${n} OR LOWER(primary_contact_name) LIKE $${n} OR LOWER(contact_email) LIKE $${n} OR LOWER(ceremony_venue_name) LIKE $${n} OR LOWER(ceremony_address) LIKE $${n})`,
      );
    }

    if (conditions.length > 0) {
      queryStr += " WHERE " + conditions.join(" AND ");
    }
    queryStr += " ORDER BY created_at DESC";

    const bookings = await sql(queryStr, values);
    return Response.json(bookings);
  } catch (error) {
    console.error("[Weddings2] List error:", error);
    return Response.json(
      { error: "Failed to fetch wedding bookings" },
      { status: 500 },
    );
  }
}

// POST /api/weddings-2 — create a new wedding booking (public wizard submit)
export async function POST(request) {
  try {
    const body = await request.json();
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
      agreed_to_terms_at,
    } = body;

    // Validation
    if (!wedding_date) {
      return Response.json(
        { error: "Wedding date is required" },
        { status: 400 },
      );
    }
    const weddingDate = new Date(wedding_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (isNaN(weddingDate.getTime()) || weddingDate < today) {
      return Response.json(
        { error: "Wedding date must be a future date" },
        { status: 400 },
      );
    }
    if (!ceremony_address) {
      return Response.json(
        { error: "Ceremony location is required" },
        { status: 400 },
      );
    }
    if (!primary_contact_name || !primary_contact_phone) {
      return Response.json(
        { error: "Primary contact name and phone are required" },
        { status: 400 },
      );
    }
    if (contact_preference !== "none" && !contact_email) {
      return Response.json(
        { error: "Email is required unless contact preference is None" },
        { status: 400 },
      );
    }
    if (!agreed_to_terms_at) {
      return Response.json(
        { error: "Terms agreement is required" },
        { status: 400 },
      );
    }

    const referenceCode = await generateReferenceCode();
    const est = estimateWeddingPrice({
      vehicles_needed,
      vehicles_not_sure,
    });

    const [booking] = await sql`
      INSERT INTO wedding_bookings_2 (
        reference_code,
        status,
        progress_step,
        is_submitted,
        submitted_at,
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
        trip_type,
        agreed_to_terms_at,
        pricing_type,
        estimated_price
      ) VALUES (
        ${referenceCode},
        'inquiry',
        5,
        true,
        NOW(),
        ${wedding_date},
        ${ceremony_time || null},
        ${ceremony_address},
        ${ceremony_venue_name || null},
        ${reception_same_as_ceremony === true},
        ${reception_time || null},
        ${reception_address || null},
        ${reception_venue_name || null},
        ${vehicles_needed ? Number(vehicles_needed) : null},
        ${vehicles_not_sure === true},
        ${estimated_passengers ? Number(estimated_passengers) : null},
        ${primary_contact_name},
        ${primary_contact_phone},
        ${contact_preference || "email_sms"},
        ${contact_email || null},
        'WEDDING',
        NOW(),
        ${est ? "estimated" : "custom"},
        ${est || 0}
      )
      RETURNING *
    `;

    // Fire "Booking Received" notification honoring contact preference
    const notifyResult = await sendWeddingNotification(
      booking,
      "booking_received",
    );

    return Response.json({
      success: true,
      booking,
      reference_code: referenceCode,
      notified: notifyResult,
    });
  } catch (error) {
    console.error("[Weddings2] Create error:", error);
    return Response.json(
      { error: "Failed to create wedding booking" },
      { status: 500 },
    );
  }
}
