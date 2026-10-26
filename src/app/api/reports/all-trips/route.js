import sql from "@/app/api/utils/sql";

export async function GET(request) {
  try {
    // Fetch all trips from the database with client and driver info
    const trips = await sql`
      SELECT 
        a.id,
        a.booking_number,
        a.start_time,
        a.status,
        a.payment_status,
        a.payment_method,
        a.services_total,
        a.payments_total,
        a.tips_total,
        a.balance_due,
        a.driver_commission,
        a.original_amount,
        a.destination,
        a.pickup_address,
        a.dropoff_address,
        a.distance_miles,
        a.num_people,
        a.notes,
        a.display_long_date,
        a.display_time,
        a.display_pickup_address,
        a.display_dropoff_address,
        c.name as client_name,
        c.phone as client_phone,
        c.email as client_email,
        e.name as employee_name,
        v.name as vehicle_name
      FROM appointments a
      LEFT JOIN clients c ON a.client_id = c.id
      LEFT JOIN employees e ON a.employee_id = e.id
      LEFT JOIN vehicles v ON a.vehicle_id = v.id
      ORDER BY a.start_time DESC
    `;

    // Fetch services for each trip
    const services = await sql`
      SELECT 
        aps.appointment_id,
        s.name as service_name,
        aps.service_price,
        aps.quantity
      FROM appointment_services aps
      LEFT JOIN services s ON aps.service_id = s.id
      ORDER BY aps.appointment_id
    `;

    // Group services by appointment
    const servicesByAppointment = {};
    services.forEach((svc) => {
      if (!servicesByAppointment[svc.appointment_id]) {
        servicesByAppointment[svc.appointment_id] = [];
      }
      servicesByAppointment[svc.appointment_id].push(svc);
    });

    // Attach services to trips
    const tripsWithServices = trips.map((trip) => ({
      ...trip,
      services: servicesByAppointment[trip.id] || [],
    }));

    return Response.json({
      success: true,
      trips: tripsWithServices,
      total: trips.length,
    });
  } catch (error) {
    console.error("Error fetching all trips report:", error);
    return Response.json(
      { error: "Failed to fetch trips report" },
      { status: 500 },
    );
  }
}
