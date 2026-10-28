import sql from "@/app/api/utils/sql";

export async function PATCH(request, { params }) {
  const { id } = params;
  try {
    const {
      employee_id,
      name,
      year,
      color,
      plate,
      is_active,
      category,
      passenger_capacity,
    } = await request.json();

    const fields = {
      employee_id,
      name,
      year,
      color,
      plate,
      is_active,
      category,
      passenger_capacity,
    };
    const updateKeys = Object.keys(fields).filter(
      (k) => fields[k] !== undefined,
    );
    if (updateKeys.length === 0)
      return Response.json({ error: "No fields to update" }, { status: 400 });

    const setClause = updateKeys.map((k, i) => `${k} = $${i + 1}`).join(", ");
    const values = updateKeys.map((k) => fields[k]);

    const [vehicle] = await sql(
      `UPDATE vehicles SET ${setClause} WHERE id = $${updateKeys.length + 1} RETURNING *`,
      [...values, id],
    );
    return Response.json(vehicle);
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Failed to update vehicle" },
      { status: 500 },
    );
  }
}

export async function DELETE(request, { params }) {
  const { id } = params;
  try {
    await sql`UPDATE vehicles SET is_active = false WHERE id = ${id}`;
    return Response.json({ success: true });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Failed to delete vehicle" },
      { status: 500 },
    );
  }
}
