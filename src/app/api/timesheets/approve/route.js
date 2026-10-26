import sql from "@/app/api/utils/sql";
import { sendEmail } from "@/app/api/utils/send-email";
import { sendSms, loadSmsConfig } from "@/app/api/utils/sms-sender";

/**
 * GET /api/timesheets/approve
 *
 * Check existing approval for a driver + period.
 * Query params: employeeId, startDate, endDate
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employeeId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!employeeId || !startDate || !endDate) {
      return Response.json(
        { error: "employeeId, startDate, and endDate are required" },
        { status: 400 },
      );
    }

    const rows = await sql`
      SELECT * FROM timesheet_approvals
      WHERE employee_id = ${parseInt(employeeId)}
        AND start_date = ${startDate}::date
        AND end_date = ${endDate}::date
      LIMIT 1
    `;

    return Response.json({ approval: rows[0] || null });
  } catch (error) {
    console.error("Error fetching timesheet approval:", error);
    return Response.json(
      { error: "Failed to fetch approval" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/timesheets/approve
 *
 * Submit a timesheet approval or rejection.
 * Body: {
 *   employeeId: number,
 *   startDate: string (YYYY-MM-DD),
 *   endDate: string (YYYY-MM-DD),
 *   approved: boolean,
 *   reason: string (required if approved === false),
 *   role: "driver" | "admin",
 *   adminName: string (optional, for admin approvals),
 *   tripIds: number[] (optional, snapshot of trip IDs)
 * }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      employeeId,
      startDate,
      endDate,
      approved,
      reason,
      role,
      adminName,
      tripIds,
      hoursWorked, // NEW: hours worked for this period
      hourlyRateOverride, // NEW: admin can override the rate for this period
    } = body;

    if (
      !employeeId ||
      !startDate ||
      !endDate ||
      typeof approved !== "boolean" ||
      !role
    ) {
      return Response.json(
        {
          error:
            "employeeId, startDate, endDate, approved, and role are required",
        },
        { status: 400 },
      );
    }

    if (!["driver", "admin"].includes(role)) {
      return Response.json(
        { error: "role must be 'driver' or 'admin'" },
        { status: 400 },
      );
    }

    if (approved === false && (!reason || reason.trim() === "")) {
      return Response.json(
        { error: "A reason is required when not approving the timesheet" },
        { status: 400 },
      );
    }

    const status = approved ? "approved" : "rejected";
    const now = new Date().toISOString();

    // ── NEW: Calculate hourly compensation if hours provided ──────────────────
    let hourlyCompensation = 0;
    if (approved && role === "admin" && hoursWorked && hoursWorked > 0) {
      // Use override rate if provided, otherwise fetch driver's default rate
      let effectiveRate = hourlyRateOverride;
      if (!effectiveRate) {
        const [emp] = await sql`
          SELECT hourly_rate FROM employees WHERE id = ${parseInt(employeeId)} LIMIT 1
        `;
        effectiveRate = emp?.hourly_rate || 0;
      }
      hourlyCompensation = parseFloat((hoursWorked * effectiveRate).toFixed(2));
    }

    // Check if record exists
    const existing = await sql`
      SELECT id FROM timesheet_approvals
      WHERE employee_id = ${parseInt(employeeId)}
        AND start_date = ${startDate}::date
        AND end_date = ${endDate}::date
    `;

    if (existing.length > 0) {
      // Update existing record
      if (role === "driver") {
        await sql`
          UPDATE timesheet_approvals
          SET driver_status = ${status},
              driver_reason = ${reason || null},
              driver_responded_at = ${now}::timestamptz,
              trip_ids = ${JSON.stringify(tripIds || [])},
              hours_worked = ${hoursWorked || 0},
              updated_at = NOW()
          WHERE id = ${existing[0].id}
        `;
      } else {
        await sql`
          UPDATE timesheet_approvals
          SET admin_status = ${status},
              admin_reason = ${reason || null},
              admin_responded_at = ${now}::timestamptz,
              admin_responded_by = ${adminName || "Admin"},
              trip_ids = ${JSON.stringify(tripIds || [])},
              hours_worked = ${hoursWorked || 0},
              hourly_compensation = ${hourlyCompensation},
              updated_at = NOW()
          WHERE id = ${existing[0].id}
        `;
      }
    } else {
      // Insert new record
      if (role === "driver") {
        await sql`
          INSERT INTO timesheet_approvals (
            employee_id, start_date, end_date,
            driver_status, driver_reason, driver_responded_at,
            trip_ids, hours_worked
          ) VALUES (
            ${parseInt(employeeId)}, ${startDate}::date, ${endDate}::date,
            ${status}, ${reason || null}, ${now}::timestamptz,
            ${JSON.stringify(tripIds || [])}, ${hoursWorked || 0}
          )
        `;
      } else {
        await sql`
          INSERT INTO timesheet_approvals (
            employee_id, start_date, end_date,
            admin_status, admin_reason, admin_responded_at, admin_responded_by,
            trip_ids, hours_worked, hourly_compensation
          ) VALUES (
            ${parseInt(employeeId)}, ${startDate}::date, ${endDate}::date,
            ${status}, ${reason || null}, ${now}::timestamptz, ${adminName || "Admin"},
            ${JSON.stringify(tripIds || [])}, ${hoursWorked || 0}, ${hourlyCompensation}
          )
        `;
      }
    }

    // ── NEW: Mark all trips as driver_paid when admin approves ────────────────
    if (approved && role === "admin" && tripIds && tripIds.length > 0) {
      try {
        console.log(
          `[Timesheet Approve] Marking ${tripIds.length} trips as driver_paid for employee ${employeeId}`,
        );
        await sql`
          UPDATE appointments
          SET driver_paid = true,
              driver_paid_at = ${now}::timestamptz,
              driver_paid_by = ${adminName || "Admin"}
          WHERE id = ANY(${tripIds})
        `;
        console.log(
          `[Timesheet Approve] Successfully marked trips as driver_paid`,
        );
      } catch (markErr) {
        console.error(
          "[Timesheet Approve] Failed to mark trips as driver_paid:",
          markErr.message,
        );
        // Don't fail the whole approval - log and continue
      }
    }

    // ── Send notifications (best-effort) ──────────────────────────────
    try {
      const driverRows =
        await sql`SELECT name, email FROM employees WHERE id = ${parseInt(employeeId)} LIMIT 1`;
      const driverName = driverRows[0]?.name || `Driver #${employeeId}`;
      const driverEmail = driverRows[0]?.email;

      const settingsRows =
        await sql`SELECT key, value FROM settings WHERE tenant_id = 1`;
      const settings = settingsRows.reduce((acc, { key, value }) => {
        acc[key] = value;
        return acc;
      }, {});

      const ownerEmail = settings.owner_email;
      const ownerPhone = settings.business_phone;
      const businessName = settings.business_name || "Catch A Ride";
      const approvalLabel = approved ? "✅ APPROVED" : "❌ NOT APPROVED";
      const periodLabel = `${startDate} to ${endDate}`;
      const roleLabel = role === "driver" ? "Driver" : "Admin";

      const emailHtml = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: ${approved ? "#10B981" : "#EF4444"};">
            Timesheet ${approvalLabel}
          </h2>
          <p><strong>Driver:</strong> ${driverName}</p>
          <p><strong>Period:</strong> ${periodLabel}</p>
          <p><strong>Decision by:</strong> ${roleLabel}${role === "admin" && adminName ? ` (${adminName})` : ""}</p>
          <p><strong>Status:</strong> ${approvalLabel}</p>
          ${reason ? `<p><strong>Reason:</strong><br/><em style="color:#555;">${reason}</em></p>` : ""}
          <p style="color:#888; font-size:12px; margin-top:24px;">${businessName} — Timesheet Notification</p>
        </div>
      `;

      // If driver submitted, notify company. If admin submitted, notify driver.
      if (role === "driver" && ownerEmail) {
        await sendEmail({
          to: ownerEmail,
          subject: `Timesheet ${approved ? "Approved" : "Not Approved"} by ${driverName} (${periodLabel})`,
          html: emailHtml,
          emailType: "timesheet_approval",
        });
      } else if (role === "admin" && driverEmail) {
        await sendEmail({
          to: driverEmail,
          subject: `Your Timesheet ${approved ? "Approved" : "Not Approved"} by Admin (${periodLabel})`,
          html: emailHtml,
          emailType: "timesheet_approval",
        });
      }

      // SMS notification
      if (role === "driver" && ownerPhone) {
        const smsConfig = await loadSmsConfig(settings);
        if (smsConfig.ready) {
          const smsText = `Timesheet ${approvalLabel} by ${driverName} (${periodLabel})${reason ? `\nReason: ${reason}` : ""}`;
          await sendSms({
            to: ownerPhone,
            message: smsText,
            config: smsConfig,
            label: "TimesheetApproval",
          });
        }
      }
    } catch (notifyErr) {
      console.error(
        "[timesheet-approve] Notification error:",
        notifyErr.message,
      );
    }

    return Response.json({
      success: true,
      message: `Timesheet ${status} by ${role}`,
    });
  } catch (error) {
    console.error("Error submitting timesheet approval:", error);
    return Response.json(
      { error: "Failed to submit approval" },
      { status: 500 },
    );
  }
}
