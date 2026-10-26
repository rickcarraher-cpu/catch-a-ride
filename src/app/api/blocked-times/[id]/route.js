import sql from "@/app/api/utils/sql";

export async function DELETE(request, { params }) {
  const { id } = params;
  try {
    await sql`UPDATE blocked_times SET is_deleted = true WHERE id = ${id}`;
    return Response.json({ success: true });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Failed to remove blocked time" },
      { status: 500 },
    );
  }
}

export async function PATCH(request, { params }) {
  const { id } = params;
  try {
    const body = await request.json();
    const { employee_id, start_time, end_time, reason, type } = body;

    const fields = [];
    const values = [];

    if (employee_id !== undefined) {
      values.push(employee_id);
      fields.push(`employee_id = $${values.length}`);
    }
    if (start_time !== undefined) {
      values.push(start_time);
      fields.push(`start_time = $${values.length}::timestamptz`);
    }
    if (end_time !== undefined) {
      values.push(end_time);
      fields.push(`end_time = $${values.length}::timestamptz`);
    }
    if (reason !== undefined) {
      values.push(reason);
      fields.push(`reason = $${values.length}`);
    }
    if (type !== undefined) {
      values.push(type);
      fields.push(`type = $${values.length}`);
    }

    if (fields.length === 0) {
      return Response.json({ error: "No fields to update" }, { status: 400 });
    }

    values.push(id);
    const result = await sql(
      `UPDATE blocked_times SET ${fields.join(", ")} WHERE id = $${values.length} RETURNING *`,
      values,
    );

    if (result.length === 0) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    return Response.json(result[0]);
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Failed to update blocked time" },
      { status: 500 },
    );
  }
}
