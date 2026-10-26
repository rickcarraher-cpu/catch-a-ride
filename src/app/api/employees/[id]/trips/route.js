import sql from "@/app/api/utils/sql";

export async function GET(request, { params }) {
  const { id } = params;
  try {
    const trips = await sql`
      SELECT id, booking_number, start_time, status, destination, pickup_address, dropoff_address
      FROM appointments
      WHERE employee_id = ${id}
        AND status NOT IN ('cancelled', 'canceled', 'deleted')
      ORDER BY start_time DESC
    `;
    return Response.json(trips);
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Failed to fetch driver trips" },
      { status: 500 },
    );
  }
}
