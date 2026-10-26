import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/auth-guard";

export async function GET(request) {
  const authCheck = await requireAuth();
  if (authCheck.error) return authCheck.error;

  try {
    const { searchParams } = new URL(request.url);
    const employee_id = searchParams.get("employee_id");

    let query = `
      SELECT v.*, e.name as employee_name,
        COALESCE(
          (SELECT json_agg(json_build_object('id', e2.id, 'name', e2.name))
           FROM vehicle_assignments va2
           JOIN employees e2 ON va2.employee_id = e2.id
           WHERE va2.vehicle_id = v.id AND e2.is_active = true),
          '[]'::json
        ) as assigned_drivers
      FROM vehicles v 
      LEFT JOIN employees e ON v.employee_id = e.id 
      WHERE v.is_active = true
    `;
    const params = [];

    if (employee_id) {
      params.push(employee_id);
      query += ` AND (v.employee_id = $${params.length} OR v.id IN (SELECT vehicle_id FROM vehicle_assignments WHERE employee_id = $${params.length}))`;
    }

    query += ` ORDER BY e.name, v.name`;

    const vehicles = await sql(query, params);
    return Response.json(vehicles);
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Failed to fetch vehicles" },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    const {
      employee_id,
      name,
      year,
      color,
      plate,
      category,
      passenger_capacity,
    } = await request.json();

    if (!name)
      return Response.json(
        { error: "Vehicle name is required" },
        { status: 400 },
      );

    // Check for duplicate vehicle (same name + color + year + plate among active vehicles)
    const duplicateCheck = await sql`
      SELECT id FROM vehicles 
      WHERE is_active = true
        AND LOWER(TRIM(name)) = LOWER(TRIM(${name}))
        AND LOWER(TRIM(COALESCE(color, ''))) = LOWER(TRIM(COALESCE(${color ?? null}, '')))
        AND COALESCE(year, '') = COALESCE(${year ?? null}, '')
        AND LOWER(TRIM(COALESCE(plate, ''))) = LOWER(TRIM(COALESCE(${plate ?? null}, '')))
      LIMIT 1
    `;
    if (duplicateCheck.length > 0) {
      return Response.json(
        {
          error:
            "A vehicle with the same name, color, year, and plate already exists",
        },
        { status: 409 },
      );
    }

    const [vehicle] = await sql`
      INSERT INTO vehicles (employee_id, name, year, color, plate, category, passenger_capacity)
      VALUES (${employee_id ?? null}, ${name}, ${year ?? null}, ${color ?? null}, ${plate ?? null}, ${category ?? null}, ${passenger_capacity ?? null})
      RETURNING *
    `;

    return Response.json(vehicle);
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Failed to create vehicle" },
      { status: 500 },
    );
  }
}
