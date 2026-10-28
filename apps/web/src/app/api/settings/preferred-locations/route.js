import sql from "@/app/api/utils/sql";

export async function GET(request) {
  try {
    const locations = await sql`
      SELECT * FROM preferred_locations 
      WHERE is_active = true 
      ORDER BY display_order ASC, label ASC
    `;
    return Response.json(locations);
  } catch (error) {
    console.error("Failed to fetch preferred locations:", error);
    return Response.json(
      { error: "Failed to fetch preferred locations" },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      label,
      street,
      city,
      state,
      zip,
      emoji = "📍",
      display_order = 0,
      email = null,
      is_airport = false,
      pickup_dropoff_instructions = null,
    } = body;

    if (!label || !street || !city || !state || !zip) {
      return Response.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const result = await sql`
      INSERT INTO preferred_locations (label, street, city, state, zip, emoji, display_order, email, is_airport, pickup_dropoff_instructions)
      VALUES (${label}, ${street}, ${city}, ${state}, ${zip}, ${emoji}, ${display_order}, ${email}, ${is_airport}, ${pickup_dropoff_instructions})
      RETURNING *
    `;

    return Response.json(result[0], { status: 201 });
  } catch (error) {
    console.error("Failed to create preferred location:", error);
    return Response.json(
      { error: "Failed to create preferred location" },
      { status: 500 },
    );
  }
}
