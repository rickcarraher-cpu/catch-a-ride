import { requireAuth } from "@/app/api/utils/auth-guard";
import { sendEmail } from "@/app/api/utils/send-email";

/**
 * Online Booking 2.0 — Test email (admin-only diagnostic)
 *
 * Sends a clearly-labeled test email using the existing email infrastructure.
 * Does NOT create appointments or touch any legacy flow data.
 */
export async function POST(request) {
  const authCheck = await requireAuth();
  if (authCheck.error) return authCheck.error;

  try {
    const { email } = await request.json();

    if (!email || !email.includes("@")) {
      return Response.json(
        { error: "A valid email address is required" },
        { status: 400 },
      );
    }

    await sendEmail({
      to: email,
      subject: "Online Booking 2.0 — Test Email",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #1e40af; margin-bottom: 8px;">Online Booking 2.0 — Test Email</h2>
          <p style="color: #374151; font-size: 15px;">
            This is a test email sent from the <strong>Online Booking 2.0</strong> dashboard.
          </p>
          <p style="color: #374151; font-size: 15px;">
            If you received this message, email delivery is configured correctly for the new
            booking flow. Confirmation emails for Online Booking 2.0 will use this same channel.
          </p>
          <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
            Sent ${new Date().toLocaleString("en-US", { timeZone: "America/Chicago" })} (Central Time)
          </p>
        </div>
      `,
      emailType: "ob2_test",
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error("[OB2 Test Email] error:", error);
    return Response.json(
      { error: error.message || "Failed to send test email" },
      { status: 500 },
    );
  }
}
