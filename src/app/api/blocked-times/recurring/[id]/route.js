import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/auth-guard";

// GET /api/blocked-times/recurring/:id - Get a specific recurring series
export async function GET(request, { params }) {
  await requireAuth();
  const { id } = params;

  const result = await sql`
    SELECT 
      rbt.*,
      e.name as employee_name,
      e.color as employee_color
    FROM recurring_blocked_times rbt
    LEFT JOIN employees e ON rbt.employee_id = e.id
    WHERE rbt.id = ${id}
    AND (rbt.is_deleted = false OR rbt.is_deleted IS NULL)
  `;

  if (result.length === 0) {
    return Response.json(
      { error: "Recurring blocked time not found" },
      { status: 404 },
    );
  }

  return Response.json(result[0]);
}

// PUT /api/blocked-times/recurring/:id - Update a recurring series
export async function PUT(request, { params }) {
  await requireAuth();
  const { id } = params;
  const body = await request.json();

  const {
    employee_id,
    start_time,
    end_time,
    frequency,
    day_of_week,
    reason,
    num_occurrences,
    type,
  } = body;

  // Build update query dynamically
  const updates = [];
  const values = [];
  let paramIndex = 1;

  if (employee_id !== undefined) {
    updates.push(`employee_id = $${paramIndex++}`);
    values.push(employee_id);
  }
  if (start_time !== undefined) {
    updates.push(`start_time = $${paramIndex++}::time`);
    values.push(start_time);
  }
  if (end_time !== undefined) {
    updates.push(`end_time = $${paramIndex++}::time`);
    values.push(end_time);
  }
  if (frequency !== undefined) {
    updates.push(`frequency = $${paramIndex++}`);
    values.push(frequency);
  }
  if (day_of_week !== undefined) {
    updates.push(`day_of_week = $${paramIndex++}`);
    values.push(day_of_week);
  }
  if (reason !== undefined) {
    updates.push(`reason = $${paramIndex++}`);
    values.push(reason);
  }
  if (num_occurrences !== undefined) {
    updates.push(`num_occurrences = $${paramIndex++}`);
    values.push(num_occurrences);
  }
  if (type !== undefined) {
    updates.push(`type = $${paramIndex++}`);
    values.push(type);
  }

  if (updates.length === 0) {
    return Response.json({ error: "No fields to update" }, { status: 400 });
  }

  values.push(id);
  const result = await sql(
    `UPDATE recurring_blocked_times SET ${updates.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
    values,
  );

  if (result.length === 0) {
    return Response.json(
      { error: "Recurring blocked time not found" },
      { status: 404 },
    );
  }

  return Response.json(result[0]);
}

// DELETE /api/blocked-times/recurring/:id - Soft delete a recurring series
export async function DELETE(request, { params }) {
  await requireAuth();
  const { id } = params;

  const result = await sql`
    UPDATE recurring_blocked_times
    SET is_deleted = true
    WHERE id = ${id}
    RETURNING *
  `;

  if (result.length === 0) {
    return Response.json(
      { error: "Recurring blocked time not found" },
      { status: 404 },
    );
  }

  return Response.json({ success: true });
}
