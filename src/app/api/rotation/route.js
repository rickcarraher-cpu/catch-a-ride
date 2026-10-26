import sql from "@/app/api/utils/sql";

// GET → returns the next driver in rotation + full sorted list
export async function GET() {
  try {
    const [drivers, settings] = await sql.transaction([
      sql`SELECT * FROM employees WHERE tenant_id = 1 AND is_active = true ORDER BY rotation_order ASC`,
      sql`SELECT key, value FROM settings WHERE tenant_id = 1 AND key IN ('rotation_current', 'rotation_start')`,
    ]);

    const currentVal = parseInt(
      settings.find((s) => s.key === "rotation_current")?.value || "1",
    );
    const startVal = parseInt(
      settings.find((s) => s.key === "rotation_start")?.value || "1",
    );

    const sorted = drivers
      .filter((d) => d.rotation_order > 0)
      .sort((a, b) => a.rotation_order - b.rotation_order);
    if (sorted.length === 0)
      return Response.json({
        next: null,
        drivers: [],
        currentOrder: currentVal,
      });

    // Find the driver whose rotation_order >= currentVal, wrap around if needed
    let next = sorted.find((d) => d.rotation_order >= currentVal);
    if (!next) next = sorted[0]; // wrap around

    return Response.json({
      next,
      drivers: sorted,
      currentOrder: currentVal,
      startOrder: startVal,
    });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Failed to get rotation" }, { status: 500 });
  }
}

// POST action=accept → advance rotation past current driver
// POST action=skip   → advance rotation to next driver (skipping current)
// POST action=reset  → reset rotation to start value
export async function POST(request) {
  try {
    const { action } = await request.json();

    const [drivers, settings] = await sql.transaction([
      sql`SELECT * FROM employees WHERE tenant_id = 1 AND is_active = true ORDER BY rotation_order ASC`,
      sql`SELECT key, value FROM settings WHERE tenant_id = 1 AND key IN ('rotation_current', 'rotation_start')`,
    ]);

    const currentVal = parseInt(
      settings.find((s) => s.key === "rotation_current")?.value || "1",
    );
    const startVal = parseInt(
      settings.find((s) => s.key === "rotation_start")?.value || "1",
    );

    const sorted = drivers
      .filter((d) => d.rotation_order > 0)
      .sort((a, b) => a.rotation_order - b.rotation_order);

    let newOrder = currentVal;

    if (action === "accept" || action === "skip") {
      // Find next driver after current
      const currentIdx = sorted.findIndex(
        (d) => d.rotation_order >= currentVal,
      );
      const nextIdx = (currentIdx + 1) % sorted.length;
      newOrder =
        sorted[nextIdx]?.rotation_order ??
        sorted[0]?.rotation_order ??
        startVal;
    } else if (action === "reset") {
      newOrder = startVal;
    }

    await sql`
      INSERT INTO settings (tenant_id, key, value)
      VALUES (1, 'rotation_current', ${String(newOrder)})
      ON CONFLICT (tenant_id, key) DO UPDATE SET value = ${String(newOrder)}
    `;

    // Return the new next driver
    const next = sorted.find((d) => d.rotation_order >= newOrder) || sorted[0];
    return Response.json({ next, drivers: sorted, currentOrder: newOrder });
  } catch (err) {
    console.error(err);
    return Response.json(
      { error: "Failed to update rotation" },
      { status: 500 },
    );
  }
}
