import sql from "@/app/api/utils/sql";

// Get appointments for a specific client
export async function GET(request, { params }) {
  try {
    const { id } = params;

    const appointments = await sql`
      SELECT a.*, 
             c.name as client_name,
             c.phone as client_phone,
             c.email as client_email,
             c.notification_preference as client_notification_preference,
             e.name as employee_name,
             v.name as vehicle_name
      FROM appointments a
      LEFT JOIN clients c ON a.client_id = c.id
      LEFT JOIN employees e ON a.employee_id = e.id
      LEFT JOIN vehicles v ON a.vehicle_id = v.id
      WHERE a.client_id = ${id} AND a.tenant_id = 1
      ORDER BY a.start_time DESC
      LIMIT 50
    `;

    // Fetch services for all appointments
    if (appointments.length > 0) {
      const appointmentIds = appointments.map((a) => a.id);
      const placeholders = appointmentIds.map((_, i) => `$${i + 1}`).join(", ");
      const services = await sql(
        `SELECT aserv.*, s.name as service_name, s.is_airport_service
         FROM appointment_services aserv
         JOIN services s ON aserv.service_id = s.id
         WHERE aserv.appointment_id IN (${placeholders})`,
        appointmentIds,
      );

      // Group services by appointment
      const servicesByAppointment = {};
      for (const svc of services) {
        if (!servicesByAppointment[svc.appointment_id]) {
          servicesByAppointment[svc.appointment_id] = [];
        }
        servicesByAppointment[svc.appointment_id].push(svc);
      }

      // Add services to appointments
      for (const apt of appointments) {
        apt.appointment_services = servicesByAppointment[apt.id] || [];
      }
    }

    return Response.json(appointments);
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Failed to fetch client appointments" },
      { status: 500 },
    );
  }
}
