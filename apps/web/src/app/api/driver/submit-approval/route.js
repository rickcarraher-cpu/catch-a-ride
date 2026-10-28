import sql from "@/app/api/utils/sql";
import { sendEmail } from "@/app/api/utils/send-email";
import { sendSms, loadSmsConfig } from "@/app/api/utils/sms-sender";

// GET — check existing approval for a driver + period
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
      SELECT id, approval_status, driver_comments, submitted_at, approved_by_role
      FROM driver_mileage_approvals
      WHERE employee_id = ${employeeId}
        AND start_date = ${startDate}
        AND end_date = ${endDate}
      LIMIT 1
    `;

    return Response.json({ approval: rows[0] || null });
  } catch (error) {
    console.error("Error fetching approval:", error);
    return Response.json(
      { error: "Failed to fetch approval" },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    const {
      employeeId,
      startDate,
      endDate,
      approved,
      comments,
      approvedTripIds,
      role, // "driver" or "admin"
      adminName, // admin name if role is admin
    } = await request.json();

    if (
      !employeeId ||
      !startDate ||
      !endDate ||
      typeof approved !== "boolean"
    ) {
      return Response.json(
        {
          error:
            "Employee ID, start date, end date, and approved status are required",
        },
        { status: 400 },
      );
    }

    if (approved === false && (!comments || comments.trim() === "")) {
      return Response.json(
        { error: "Comments are required when not approving timesheet" },
        { status: 400 },
      );
    }

    const approvalStatus = approved ? "approved" : "rejected";
    const approvedByRole = role === "admin" ? "admin" : "driver";
    const approvedByName = role === "admin" && adminName ? adminName : null;

    // Check if approval already exists for this period
    const existing = await sql`
      SELECT id FROM driver_mileage_approvals
      WHERE employee_id = ${employeeId}
        AND start_date = ${startDate}
        AND end_date = ${endDate}
    `;

    let approvalId;
    if (existing.length > 0) {
      await sql`
        UPDATE driver_mileage_approvals
        SET approval_status = ${approvalStatus},
            driver_comments = ${comments || null},
            submitted_at = NOW(),
            approved_trip_ids = ${JSON.stringify(approvedTripIds || [])},
            approved_by_role = ${approvedByRole},
            approved_by_name = ${approvedByName}
        WHERE id = ${existing[0].id}
      `;
      approvalId = existing[0].id;
    } else {
      const result = await sql`
        INSERT INTO driver_mileage_approvals (
          employee_id, start_date, end_date, approval_status, driver_comments, submitted_at, 
          approved_trip_ids, approved_by_role, approved_by_name
        )
        VALUES (
          ${employeeId}, ${startDate}, ${endDate}, ${approvalStatus}, ${comments || null}, NOW(), 
          ${JSON.stringify(approvedTripIds || [])}, ${approvedByRole}, ${approvedByName}
        )
        RETURNING id
      `;
      approvalId = result[0].id;
    }

    // ── Send notifications (best-effort) ──────────────────────────────────
    try {
      // Fetch driver name and email
      const driverRows = await sql`
        SELECT name, email FROM employees WHERE id = ${employeeId} LIMIT 1
      `;
      const driverName = driverRows[0]?.name || `Driver #${employeeId}`;
      const driverEmail = driverRows[0]?.email;

      // Fetch company settings
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
      const approverLabel =
        role === "admin"
          ? `Admin${adminName ? ` (${adminName})` : ""}`
          : "Driver";

      const emailHtml = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: ${approved ? "#10B981" : "#EF4444"};">
            Timesheet ${approvalLabel}
          </h2>
          <p><strong>Driver:</strong> ${driverName}</p>
          <p><strong>Period:</strong> ${periodLabel}</p>
          <p><strong>Decision by:</strong> ${approverLabel}</p>
          <p><strong>Status:</strong> ${approvalLabel}</p>
          ${comments ? `<p><strong>Reason:</strong><br/><em style="color:#555;">${comments}</em></p>` : ""}
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
        console.log(
          `[submit-approval] ✅ Email sent to company at ${ownerEmail}`,
        );
      } else if (role === "admin" && driverEmail) {
        await sendEmail({
          to: driverEmail,
          subject: `Your Timesheet ${approved ? "Approved" : "Not Approved"} by Admin (${periodLabel})`,
          html: emailHtml,
          emailType: "timesheet_approval",
        });
        console.log(
          `[submit-approval] ✅ Email sent to driver at ${driverEmail}`,
        );
      }

      // SMS notification
      if (role === "driver" && ownerPhone) {
        const smsConfig = await loadSmsConfig(settings);
        if (smsConfig.ready) {
          const smsText = `Timesheet ${approvalLabel} by ${driverName} (${periodLabel})${comments ? `\nReason: ${comments}` : ""}`;
          const result = await sendSms({
            to: ownerPhone,
            message: smsText,
            config: smsConfig,
            label: "TimesheetApproval",
          });

          if (result.success) {
            console.log(`[submit-approval] ✅ SMS sent to ${ownerPhone}`);
          } else {
            console.error(`[submit-approval] ❌ SMS failed: ${result.error}`);
          }
        }
      }
    } catch (notifyErr) {
      // Don't fail the request if notifications fail
      console.error("[submit-approval] Notification error:", notifyErr.message);
    }

    return Response.json({
      success: true,
      message:
        existing.length > 0
          ? "Approval updated successfully"
          : "Approval submitted successfully",
      approvalId,
    });
  } catch (error) {
    console.error("Error submitting approval:", error);
    return Response.json(
      { error: "Failed to submit approval" },
      { status: 500 },
    );
  }
}
