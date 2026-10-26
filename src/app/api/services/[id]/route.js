import sql from "@/app/api/utils/sql";

export async function PATCH(request, { params }) {
  const { id } = params;
  try {
    const body = await request.json();
    const fields = Object.keys(body).filter((k) =>
      [
        "name",
        "description",
        "default_price",
        "duration_minutes",
        "is_variable_price",
        "display_order",
        "is_active",
        "is_airport_service",
        "is_addon",
        "can_passenger_request",
        "is_tip_addon",
      ].includes(k),
    );

    if (fields.length === 0)
      return Response.json({ error: "No fields to update" }, { status: 400 });

    const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(", ");
    const values = fields.map((f) => body[f]);

    const result = await sql(
      `UPDATE services SET ${setClause} WHERE id = $${fields.length + 1} AND tenant_id = 1 RETURNING *`,
      [...values, id],
    );

    return Response.json(result[0]);
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Failed to update service" },
      { status: 500 },
    );
  }
}

export async function DELETE(request, { params }) {
  const { id } = params;
  try {
    const result = await sql(
      `UPDATE services SET is_active = false WHERE id = $1 AND tenant_id = 1 RETURNING *`,
      [id],
    );
    if (!result.length) {
      return Response.json({ error: "Service not found" }, { status: 404 });
    }
    return Response.json({
      success: true,
      note: "Service deactivated. All historical data preserved.",
      deactivated: result[0],
    });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Failed to deactivate service" },
      { status: 500 },
    );
  }
}
