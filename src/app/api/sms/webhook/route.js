import { createHmac } from "crypto";
import sql from "@/app/api/utils/sql";
import {
  sendSms as unifiedSendSms,
  loadSmsConfig,
  calculateSegmentCount,
} from "@/app/api/utils/sms-sender";
import {
  findConversationByPhone,
  getOtherParticipants,
  updateConversationTimestamp,
} from "@/app/api/utils/conversations";

// Normalize phone number to E.164 for comparison
function normalizePhone(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length >= 10) return `+${digits}`;
  return null;
}

/**
 * Guard against duplicate inbound inserts caused by provider webhook retries.
 * Returns true if the same message body from the same phone was already stored
 * within the last 60 seconds.
 */
async function isInboundDuplicate(phone, message) {
  try {
    const rows = await sql(
      `SELECT id FROM sms_messages
       WHERE phone = $1
         AND direction = 'inbound'
         AND LEFT(message, 200) = LEFT($2, 200)
         AND sent_at > NOW() - INTERVAL '60 seconds'
       LIMIT 1`,
      [phone, (message || "").substring(0, 200)],
    );
    return rows.length > 0;
  } catch (err) {
    console.error(
      "[SMS Webhook] Inbound dedup check failed (failing open):",
      err.message,
    );
    return false; // fail open so we never drop a real message
  }
}

// Detect confirmation/acceptance keywords in SMS messages
// Returns { action: 'accept'|'decline'|null, confidence: 'high'|'medium' }
function detectConfirmationKeyword(message) {
  if (!message) return { action: null };

  const normalized = message.trim().toLowerCase();

  // High confidence positive keywords
  if (/^(yes|y|confirm|confirmed|accept|accepted|ok|okay)$/i.test(normalized)) {
    return { action: "accept", confidence: "high" };
  }

  // High confidence negative keywords
  if (/^(no|n|cancel|cancelled|decline|declined|nope)$/i.test(normalized)) {
    return { action: "decline", confidence: "high" };
  }

  // Medium confidence - longer messages containing keywords
  if (/\b(yes|confirm|accept)\b/i.test(normalized)) {
    return { action: "accept", confidence: "medium" };
  }

  if (/\b(no|cancel|decline)\b/i.test(normalized)) {
    return { action: "decline", confidence: "medium" };
  }

  return { action: null };
}

// Process keyword confirmation/acceptance
async function processKeywordResponse({
  appointmentId,
  senderType,
  senderName,
  action,
  settings,
  smsConfig,
  senderPhone,
  conversationId,
}) {
  if (!appointmentId || !action) return;

  const businessName = settings.business_name || "Catch A Ride";

  try {
    // Get appointment details with FULL trip information for drivers AND current confirmation status
    const [appt] = await sql`
      SELECT 
        a.id, 
        a.booking_number, 
        a.start_time,
        a.passenger_confirmed,
        a.driver_accepted,
        a.status,
        a.pickup_address,
        a.pickup_street,
        a.pickup_city,
        a.pickup_state,
        a.pickup_zip,
        a.dropoff_address,
        a.dropoff_street,
        a.dropoff_city,
        a.dropoff_state,
        a.dropoff_zip,
        a.destination,
        a.num_people,
        a.num_bags_checked,
        a.num_bags_carry_on,
        a.outgoing_flight_info,
        a.returning_flight_info,
        a.driver_notes,
        a.notes,
        c.name AS client_name,
        c.email AS client_email,
        c.phone AS client_phone,
        e.name AS employee_name,
        e.email AS employee_email,
        e.phone AS employee_phone
      FROM appointments a
      LEFT JOIN clients c ON a.client_id = c.id
      LEFT JOIN employees e ON a.employee_id = e.id
      WHERE a.id = ${appointmentId}
    `;

    if (!appt) return;

    let confirmationMessage = "";
    let adminNotification = "";

    // ── PASSENGER CONFIRMATION ────────────────────────────────────────────
    if (senderType === "passenger") {
      if (action === "accept") {
        // Check if already confirmed
        if (appt.passenger_confirmed === "confirmed") {
          console.log(
            `[Keyword] Passenger already confirmed trip #${appointmentId}`,
          );
          return;
        }

        // Check if driver has also accepted to determine if we should mark as 'confirmed'
        const driverAccepted = appt.driver_accepted === "accepted";
        const shouldMarkConfirmed = driverAccepted;

        if (shouldMarkConfirmed) {
          console.log(
            `[Keyword] ✅ BOTH passenger confirmed AND driver accepted - setting status to 'confirmed'`,
          );
        } else {
          console.log(
            `[Keyword] ⏳ Passenger confirmed, but driver hasn't accepted yet - status remains ${appt.status}`,
          );
        }

        // Update to confirmed
        await sql`
          UPDATE appointments 
          SET 
            passenger_confirmed = 'confirmed',
            passenger_response_at = CURRENT_TIMESTAMP,
            status = CASE
              WHEN ${shouldMarkConfirmed} THEN 'confirmed'
              ELSE status
            END
          WHERE id = ${appointmentId}
        `;

        confirmationMessage = `✅ Thank you ${senderName}! Your trip (Booking #${appt.booking_number}) with ${businessName} is confirmed. We'll see you on ${new Date(appt.start_time).toLocaleDateString("en-US", { month: "short", day: "numeric" })} at ${new Date(appt.start_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}.`;

        adminNotification = `✅ Passenger ${senderName} CONFIRMED Trip #${appt.booking_number} via SMS${shouldMarkConfirmed ? " — Trip now FULLY CONFIRMED (both parties accepted)" : " — Waiting for driver acceptance"}`;

        console.log(
          `[Keyword] ✅ Passenger ${senderName} confirmed trip #${appointmentId}`,
        );
      } else if (action === "decline") {
        // Check if already cancelled
        if (appt.passenger_confirmed === "cancelled") {
          console.log(
            `[Keyword] Passenger already cancelled trip #${appointmentId}`,
          );
          return;
        }

        // Update to cancelled - set trip status to cancelled
        await sql`
          UPDATE appointments 
          SET 
            passenger_confirmed = 'cancelled',
            passenger_response_at = CURRENT_TIMESTAMP,
            status = 'cancelled'
          WHERE id = ${appointmentId}
        `;

        confirmationMessage = `Your trip (Booking #${appt.booking_number}) has been cancelled. If you need to reschedule, please contact ${businessName}.`;

        adminNotification = `❌ Passenger ${senderName} CANCELLED Trip #${appt.booking_number} via SMS`;

        console.log(
          `[Keyword] ❌ Passenger ${senderName} cancelled trip #${appointmentId}`,
        );
      }
    }

    // ── DRIVER ACCEPTANCE ─────────────────────────────────────────────────
    if (senderType === "driver") {
      if (action === "accept") {
        // Check if already accepted
        if (appt.driver_accepted === "accepted") {
          console.log(
            `[Keyword] Driver already accepted trip #${appointmentId}`,
          );
          return;
        }

        // Check if passenger has also confirmed to determine if we should mark as 'confirmed'
        const passengerConfirmed = appt.passenger_confirmed === "confirmed";
        const shouldMarkConfirmed = passengerConfirmed;

        if (shouldMarkConfirmed) {
          console.log(
            `[Keyword] ✅ BOTH driver accepted AND passenger confirmed - setting status to 'confirmed'`,
          );
        } else {
          console.log(
            `[Keyword] ⏳ Driver accepted, but passenger hasn't confirmed yet - status remains ${appt.status}`,
          );
        }

        // Update to accepted
        await sql`
          UPDATE appointments 
          SET 
            driver_accepted = 'accepted',
            driver_response_at = CURRENT_TIMESTAMP,
            status = CASE
              WHEN ${shouldMarkConfirmed} THEN 'confirmed'
              ELSE status
            END
          WHERE id = ${appointmentId}
        `;

        // Build comprehensive driver confirmation with ALL trip details
        const dateStr = new Date(appt.start_time).toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        });
        const timeStr = new Date(appt.start_time).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });

        let details = [];
        details.push(`✅ ACCEPTED: Trip #${appt.booking_number}`);
        details.push(`📅 ${dateStr} at ${timeStr}`);
        details.push(`👤 Passenger: ${appt.client_name || "Unknown"}`);

        if (appt.client_phone) {
          details.push(`📞 ${appt.client_phone}`);
        }

        // Pickup location
        if (appt.pickup_street || appt.pickup_address) {
          const pickup = appt.pickup_street
            ? `${appt.pickup_street}, ${appt.pickup_city || ""} ${appt.pickup_state || ""}`.trim()
            : appt.pickup_address;
          details.push(`📍 Pickup: ${pickup}`);
        }

        // Dropoff location
        if (appt.dropoff_street || appt.dropoff_address || appt.destination) {
          const dropoff = appt.dropoff_street
            ? `${appt.dropoff_street}, ${appt.dropoff_city || ""} ${appt.dropoff_state || ""}`.trim()
            : appt.dropoff_address || appt.destination;
          details.push(`🎯 Dropoff: ${dropoff}`);
        }

        // Passenger and baggage info
        if (appt.num_people) {
          details.push(
            `👥 ${appt.num_people} passenger${appt.num_people > 1 ? "s" : ""}`,
          );
        }
        if (appt.num_bags_checked || appt.num_bags_carry_on) {
          const bags = [];
          if (appt.num_bags_checked)
            bags.push(`${appt.num_bags_checked} checked`);
          if (appt.num_bags_carry_on)
            bags.push(`${appt.num_bags_carry_on} carry-on`);
          details.push(`🧳 Bags: ${bags.join(", ")}`);
        }

        // FLIGHT INFORMATION - Most important for drivers!
        if (appt.outgoing_flight_info) {
          details.push(`✈️ OUTGOING: ${appt.outgoing_flight_info}`);
        }
        if (appt.returning_flight_info) {
          details.push(`✈️ RETURNING: ${appt.returning_flight_info}`);
        }

        // Driver notes (special instructions)
        if (appt.driver_notes) {
          details.push(`📝 Notes: ${appt.driver_notes}`);
        }

        confirmationMessage = details.join("\n");

        adminNotification = `✅ Driver ${senderName} ACCEPTED Trip #${appt.booking_number} via SMS${shouldMarkConfirmed ? " — Trip now FULLY CONFIRMED (both parties accepted)" : " — Waiting for passenger confirmation"}`;

        console.log(
          `[Keyword] ✅ Driver ${senderName} accepted trip #${appointmentId}`,
        );
      } else if (action === "decline") {
        // Check if already declined
        if (appt.driver_accepted === "declined") {
          console.log(
            `[Keyword] Driver already declined trip #${appointmentId}`,
          );
          return;
        }

        // Update to declined and unassign the driver
        await sql`
          UPDATE appointments 
          SET 
            driver_accepted = 'declined',
            driver_response_at = CURRENT_TIMESTAMP,
            employee_id = NULL,
            status = CASE 
              WHEN status = 'confirmed' THEN 'pending'
              ELSE status
            END
          WHERE id = ${appointmentId}
        `;

        confirmationMessage = `You've declined Trip #${appt.booking_number}. ${businessName} will reassign this trip.`;

        adminNotification = `❌ Driver ${senderName} DECLINED Trip #${appt.booking_number} via SMS - trip unassigned and reverted to pending`;

        console.log(
          `[Keyword] ❌ Driver ${senderName} declined trip #${appointmentId} - trip unassigned`,
        );
      }
    }

    // ── Send confirmation SMS back to sender ──────────────────────────────
    if (confirmationMessage) {
      if (
        smsConfig.provider === "ClickSend" &&
        smsConfig.username &&
        smsConfig.apiKey
      ) {
        try {
          await unifiedSendSms({
            username: smsConfig.username,
            apiKey: smsConfig.apiKey,
            from: smsConfig.from,
            to: senderPhone,
            message: confirmationMessage,
          });

          // Store confirmation message
          await sql`
            INSERT INTO sms_messages (
              tenant_id, conversation_id, appointment_id, direction, phone, message, provider, metadata
            ) VALUES (
              1, ${conversationId}, ${appointmentId}, 'outbound', ${senderPhone}, ${confirmationMessage}, 'ClickSend',
              ${JSON.stringify({ is_auto_confirmation: true, recipient_type: senderType })}
            )
          `;

          console.log(`[Keyword] Sent confirmation SMS to ${senderName}`);
        } catch (err) {
          console.error(
            "[Keyword] Failed to send confirmation SMS:",
            err.message,
          );
        }
      } else if (
        smsConfig.provider === "Quo" &&
        smsConfig.apiKey &&
        smsConfig.phoneNumberId
      ) {
        try {
          await unifiedSendSms({
            apiKey: smsConfig.apiKey,
            phoneNumberId: smsConfig.phoneNumberId,
            userId: smsConfig.userId,
            to: senderPhone,
            message: confirmationMessage,
          });

          // Store confirmation message
          await sql`
            INSERT INTO sms_messages (
              tenant_id, conversation_id, appointment_id, direction, phone, message, provider, metadata
            ) VALUES (
              1, ${conversationId}, ${appointmentId}, 'outbound', ${senderPhone}, ${confirmationMessage}, 'Quo',
              ${JSON.stringify({ is_auto_confirmation: true, recipient_type: senderType })}
            )
          `;

          console.log(`[Keyword] Sent confirmation SMS to ${senderName}`);
        } catch (err) {
          console.error(
            "[Keyword] Failed to send confirmation SMS:",
            err.message,
          );
        }
      }
    }

    // ── Send admin notification ───────────────────────────────────────────
    if (adminNotification) {
      const adminPhone = settings.business_phone;
      if (
        adminPhone &&
        normalizePhone(adminPhone) !== normalizePhone(senderPhone)
      ) {
        if (
          smsConfig.provider === "ClickSend" &&
          smsConfig.username &&
          smsConfig.apiKey
        ) {
          try {
            await unifiedSendSms({
              username: smsConfig.username,
              apiKey: smsConfig.apiKey,
              from: smsConfig.from,
              to: adminPhone,
              message: adminNotification,
            });
            console.log(`[Keyword] Sent admin notification to ${adminPhone}`);
          } catch (err) {
            console.error(
              "[Keyword] Failed to send admin notification:",
              err.message,
            );
          }
        } else if (
          smsConfig.provider === "Quo" &&
          smsConfig.apiKey &&
          smsConfig.phoneNumberId
        ) {
          try {
            await unifiedSendSms({
              apiKey: smsConfig.apiKey,
              phoneNumberId: smsConfig.phoneNumberId,
              userId: smsConfig.userId,
              to: adminPhone,
              message: adminNotification,
            });
            console.log(`[Keyword] Sent admin notification to ${adminPhone}`);
          } catch (err) {
            console.error(
              "[Keyword] Failed to send admin notification:",
              err.message,
            );
          }
        }
      }
    }
  } catch (err) {
    console.error("[Keyword] Error processing keyword response:", err.message);
  }
}

// Quo sends a POST with openphone-signature header for verification
function verifyQuoSignature(rawBody, sigHeader, signingSecret) {
  if (!sigHeader || !signingSecret) return false;
  try {
    const parts = sigHeader.split(";");
    if (parts.length < 4) return false;
    const timestamp = parts[2];
    const providedDigest = parts[3];
    const signedData = `${timestamp}.${rawBody}`;
    const keyBinary = Buffer.from(signingSecret, "base64").toString("binary");
    const computedDigest = createHmac("sha256", keyBinary)
      .update(Buffer.from(signedData, "utf8"))
      .digest("base64");
    return providedDigest === computedDigest;
  } catch {
    return false;
  }
}

/**
 * Try to extract ClickSend inbound SMS fields from various payload formats.
 * ClickSend may send as form-urlencoded, JSON, or JSON with nested data arrays.
 * Field names vary by webhook_type setting (post, get, json).
 */
function parseClickSendPayload(rawBody, contentType) {
  let fromPhone = null;
  let messageBody = null;
  let receivedAt = null;
  let mediaUrls = []; // NEW: Array of media URLs for MMS

  console.log("[ClickSend Parser] Attempting to parse payload...");
  console.log("[ClickSend Parser] Content-Type:", contentType);
  console.log("[ClickSend Parser] Raw body:", rawBody);

  // Try JSON first (ClickSend sends JSON when webhook_type is "json")
  try {
    const json = JSON.parse(rawBody);
    console.log(
      "[ClickSend Parser] Parsed as JSON:",
      JSON.stringify(json, null, 2),
    );

    // ClickSend JSON webhook can be a single object or wrapped in a data array
    const msg = Array.isArray(json.data) ? json.data[0] : json.data || json;

    if (msg) {
      // ClickSend uses these field names in their inbound SMS webhook:
      // from, original_message_id, body, original_message, timestamp, to, message_id, media
      fromPhone =
        msg.from ||
        msg.from_number ||
        msg.sender ||
        msg.mobile ||
        msg.phone ||
        null;
      messageBody =
        msg.body ||
        msg.original_message ||
        msg.message ||
        msg.text ||
        msg.message_body ||
        null;
      receivedAt =
        msg.timestamp || msg.date || msg.received_at || msg.datetime || null;

      // NEW: Extract MMS media URLs
      if (msg.media && Array.isArray(msg.media)) {
        mediaUrls = msg.media.map((m) => m.url || m).filter(Boolean);
        console.log(
          `[ClickSend Parser] Found ${mediaUrls.length} MMS attachments`,
        );
      }

      // ClickSend timestamps can be Unix timestamps (seconds)
      if (receivedAt && typeof receivedAt === "number") {
        receivedAt = new Date(receivedAt * 1000).toISOString();
      }

      if (fromPhone && (messageBody || mediaUrls.length > 0)) {
        console.log("[ClickSend Parser] ✅ Parsed as JSON");
        console.log(
          `[ClickSend Parser] From: ${fromPhone}, Message: ${messageBody}, Media: ${mediaUrls.length} files`,
        );
        return {
          fromPhone: normalizePhone(fromPhone),
          messageBody: (messageBody || "").trim() || "[MMS]",
          receivedAt: receivedAt || new Date().toISOString(),
          mediaUrls, // NEW: Include media URLs
        };
      } else {
        console.log("[ClickSend Parser] ❌ JSON parsing incomplete:", {
          fromPhone,
          messageBody,
          mediaUrls,
          availableKeys: Object.keys(msg),
        });
      }
    }
  } catch (e) {
    console.log("[ClickSend Parser] Not JSON:", e.message);
  }

  // Try form-urlencoded (ClickSend sends this when webhook_type is "post")
  try {
    const params = new URLSearchParams(rawBody);

    // Log all parameters for debugging
    console.log("[ClickSend Parser] URL Parameters:");
    for (const [key, value] of params.entries()) {
      console.log(`  ${key}: ${value}`);
    }

    fromPhone =
      params.get("from") ||
      params.get("from_number") ||
      params.get("sender") ||
      params.get("mobile") ||
      params.get("phone") ||
      null;
    messageBody =
      params.get("body") ||
      params.get("original_message") ||
      params.get("message") ||
      params.get("text") ||
      params.get("message_body") ||
      null;
    receivedAt =
      params.get("timestamp") ||
      params.get("date") ||
      params.get("datetime") ||
      params.get("received_at") ||
      null;

    // NEW: Extract MMS media from form params
    // ClickSend may send media[0], media[1], etc. or media as comma-separated
    const mediaKeys = Array.from(params.keys()).filter((k) =>
      k.startsWith("media"),
    );
    if (mediaKeys.length > 0) {
      mediaUrls = mediaKeys.map((k) => params.get(k)).filter(Boolean);
      console.log(
        `[ClickSend Parser] Found ${mediaUrls.length} MMS attachments in form data`,
      );
    } else if (params.get("media")) {
      mediaUrls = params
        .get("media")
        .split(",")
        .map((u) => u.trim())
        .filter(Boolean);
      console.log(
        `[ClickSend Parser] Found ${mediaUrls.length} MMS attachments (comma-separated)`,
      );
    }

    // ClickSend timestamps can be Unix timestamps (seconds)
    if (receivedAt && /^\d+$/.test(receivedAt)) {
      receivedAt = new Date(Number(receivedAt) * 1000).toISOString();
    }

    if (fromPhone && (messageBody || mediaUrls.length > 0)) {
      console.log("[ClickSend Parser] ✅ Parsed as form-urlencoded");
      console.log(
        `[ClickSend Parser] From: ${fromPhone}, Message: ${messageBody}, Media: ${mediaUrls.length} files`,
      );
      return {
        fromPhone: normalizePhone(fromPhone),
        messageBody: (messageBody || "").trim() || "[MMS]",
        receivedAt: receivedAt || new Date().toISOString(),
        mediaUrls, // NEW: Include media URLs
      };
    } else {
      console.log("[ClickSend Parser] ❌ Form-urlencoded parsing incomplete:", {
        fromPhone,
        messageBody,
        mediaUrls,
      });
    }
  } catch (e) {
    console.log("[ClickSend Parser] Not form-urlencoded:", e.message);
  }

  console.log(
    "[ClickSend Parser] ❌ Failed to parse payload - no 'from' + 'body/message' found",
  );
  console.log(
    "[ClickSend Parser] 💡 Make sure ClickSend inbound rule webhook_type is set to 'json' or 'post'",
  );
  return {
    fromPhone: null,
    messageBody: null,
    receivedAt: null,
    mediaUrls: [],
  };
}

/**
 * GET endpoint for webhook verification
 * This allows you to test if the webhook URL is reachable
 */
export async function GET(request) {
  return Response.json({
    status: "ok",
    message: "ClickSend webhook endpoint is active",
    timestamp: new Date().toISOString(),
    url: request.url,
  });
}

export async function POST(request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    const rawBody = await request.text();

    console.log("[SMS Webhook] ===== INCOMING WEBHOOK =====");
    console.log("[SMS Webhook] Content-Type:", contentType);
    console.log(
      "[SMS Webhook] Headers:",
      JSON.stringify(Object.fromEntries(request.headers.entries())),
    );
    console.log(
      "[SMS Webhook] Body (first 1000 chars):",
      rawBody.substring(0, 1000),
    );
    console.log("[SMS Webhook] Full Body:", rawBody);

    // Load settings
    const settingsRows =
      await sql`SELECT key, value FROM settings WHERE tenant_id = 1`;
    const settings = settingsRows.reduce((acc, { key, value }) => {
      acc[key] = value;
      return acc;
    }, {});

    const smsConfig = await loadSmsConfig();
    console.log("[SMS Webhook] SMS Provider setting:", smsConfig.provider);

    // ── ClickSend Inbound SMS ─────────────────────────────────────────────
    if (
      smsConfig.provider === "ClickSend" ||
      !smsConfig.provider ||
      smsConfig.provider === "None"
    ) {
      const { fromPhone, messageBody, receivedAt, mediaUrls } =
        parseClickSendPayload(rawBody, contentType);

      console.log("[ClickSend Webhook] Parsed payload:", {
        fromPhone,
        messageBody,
        receivedAt,
        mediaUrls,
      });

      if (fromPhone && (messageBody || (mediaUrls && mediaUrls.length > 0))) {
        console.log(
          `[ClickSend Webhook] Inbound SMS from ${fromPhone}: "${messageBody}"${mediaUrls && mediaUrls.length > 0 ? ` with ${mediaUrls.length} media attachment(s)` : ""}`,
        );

        // Calculate segment count for inbound message
        const segmentCount = calculateSegmentCount(messageBody);

        // ── Find Conversation and Forward to All Participants ─────────────
        const conversation = await findConversationByPhone(fromPhone);

        if (conversation) {
          console.log(
            `[SMS Webhook] Found conversation ${conversation.id} for ${fromPhone}`,
          );

          // Get sender info from participants
          const sender = conversation.participants.find(
            (p) => p.phone === fromPhone,
          );
          const senderName = sender?.name || "Unknown";
          const senderType = sender?.participant_type || "unknown";

          // Store the incoming message with conversation_id, media URLs, and segment count
          // Guard: skip if same message already stored in the last 60s (webhook retry protection)
          const dupCheck = await isInboundDuplicate(fromPhone, messageBody);
          if (dupCheck) {
            console.log(
              `[ClickSend Webhook] Duplicate inbound message from ${fromPhone} — skipping insert`,
            );
            return Response.json({ received: true });
          }

          await sql`
            INSERT INTO sms_messages (
              tenant_id, conversation_id, appointment_id, client_id, direction, phone, message, sender_name, sent_at, provider, metadata, segment_count
            ) VALUES (
              1, ${conversation.id}, ${conversation.appointment_id}, ${sender?.client_id || null}, 'inbound', ${fromPhone}, ${messageBody}, ${senderName}, ${receivedAt}, 'ClickSend', ${JSON.stringify({ sender_type: senderType, media_urls: mediaUrls || [] })}, ${segmentCount}
            )
          `;

          // Update conversation timestamp
          await updateConversationTimestamp(conversation.id);

          // ── KEYWORD DETECTION: Check for YES/NO confirmation/acceptance ───
          const keywordDetection = detectConfirmationKeyword(messageBody);
          if (keywordDetection.action) {
            console.log(
              `[ClickSend Webhook] Detected keyword: ${keywordDetection.action} (${keywordDetection.confidence} confidence)`,
            );

            await processKeywordResponse({
              appointmentId: conversation.appointment_id,
              senderType,
              senderName,
              action: keywordDetection.action,
              settings,
              smsConfig,
              senderPhone: fromPhone,
              conversationId: conversation.id,
            });
          }

          // Forward to all other participants
          const otherParticipants = await getOtherParticipants(
            conversation.id,
            fromPhone,
          );
          console.log(
            `[SMS Webhook] Forwarding to ${otherParticipants.length} other participants`,
          );

          const clicksendUsername =
            settings.clicksend_username || process.env.CLICKSEND_USERNAME;
          const clicksendApiKey =
            settings.clicksend_api_key || process.env.CLICKSEND_API_KEY;
          const clicksendFrom = settings.clicksend_from || "CatchARide";

          if (clicksendUsername && clicksendApiKey) {
            for (const participant of otherParticipants) {
              try {
                const forwardedMessage = `From ${senderName}: ${messageBody}`;

                await unifiedSendSms({
                  username: clicksendUsername,
                  apiKey: clicksendApiKey,
                  from: clicksendFrom,
                  to: participant.phone,
                  message: forwardedMessage,
                });

                // Store the forwarded message
                await sql`
                  INSERT INTO sms_messages (
                    tenant_id, conversation_id, appointment_id, client_id, employee_id, direction, phone, message, sender_name, provider, metadata
                  ) VALUES (
                    1, ${conversation.id}, ${conversation.appointment_id}, ${participant.client_id || null}, ${participant.employee_id || null}, 'outbound', ${participant.phone}, ${forwardedMessage}, ${participant.name}, 'ClickSend', ${JSON.stringify({ forwarded_from: senderName, is_auto_forward: true })}
                  )
                `;

                console.log(
                  `[SMS Webhook] Forwarded message to ${participant.name} (${participant.phone})`,
                );
              } catch (forwardErr) {
                console.error(
                  `[SMS Webhook] Failed to forward to ${participant.phone}:`,
                  forwardErr,
                );
              }
            }

            // ── Driver copy: forward inbound passenger messages to owner ──────
            // TEMPORARILY DISABLED: Quo only delivers to 2 of 3 recipients simultaneously.
            // Removing company phone copy until Quo resolves this limitation.
            /*
            if (conversation.appointment_id && senderType === "passenger") {
              try {
                const ownerPhone = settings.business_phone;
                if (ownerPhone) {
                  const normalizedOwnerPhone = normalizePhone(ownerPhone);
                  // Check if driver has the copy flag
                  const driverRows = await sql`
                    SELECT e.copy_communications_to_company, e.name AS driver_name
                    FROM appointments a
                    JOIN employees e ON a.employee_id = e.id
                    WHERE a.id = ${conversation.appointment_id}
                      AND e.copy_communications_to_company = true
                    LIMIT 1
                  `;
                  if (driverRows.length > 0) {
                    const driverName = driverRows[0].driver_name;
                    // Only send if owner isn't already among the forwarded participants
                    const ownerAlreadyForwarded = otherParticipants.some(
                      (p) => normalizePhone(p.phone) === normalizedOwnerPhone,
                    );
                    if (
                      !ownerAlreadyForwarded &&
                      normalizedOwnerPhone !== fromPhone
                    ) {
                      const copyMsg = `[COPY - Driver: ${driverName}] From ${senderName}: ${messageBody}`;
                      await unifiedSendSms({
                        username: clicksendUsername,
                        apiKey: clicksendApiKey,
                        from: clicksendFrom,
                        to: ownerPhone,
                        message: copyMsg,
                      });
                      await sql`
                        INSERT INTO sms_messages (
                          tenant_id, conversation_id, appointment_id, direction, phone, message, provider, metadata
                        ) VALUES (
                          1, ${conversation.id}, ${conversation.appointment_id}, 'outbound', ${normalizedOwnerPhone}, ${copyMsg}, 'ClickSend',
                          ${JSON.stringify({ forwarded_from: senderName, is_driver_copy: true, original_sender: "passenger" })}
                        )
                      `;
                      console.log(
                        `[SMS Webhook] Forwarded inbound passenger msg to owner ${ownerPhone} (driver copy enabled for ${driverName})`,
                      );
                    }
                  }
                }
              } catch (copyErr) {
                console.error(
                  "[SMS Webhook] Failed to send driver copy to owner:",
                  copyErr.message,
                );
              }
            }
            */
          }
        } else {
          // No conversation found - fall back to old behavior (match to client)
          console.log(
            `[SMS Webhook] No conversation found for ${fromPhone} - using legacy client matching`,
          );

          // Guard: skip if same message already stored in the last 60s (webhook retry protection)
          const legacyDupCheck = await isInboundDuplicate(
            fromPhone,
            messageBody,
          );
          if (legacyDupCheck) {
            console.log(
              `[ClickSend Webhook] Duplicate inbound message (legacy path) from ${fromPhone} — skipping insert`,
            );
            return Response.json({ received: true });
          }

          const clients =
            await sql`SELECT id, name, phone FROM clients WHERE tenant_id = 1`;
          const matchedClient = clients.find(
            (c) => c.phone && normalizePhone(c.phone) === fromPhone,
          );

          if (matchedClient) {
            const [recentAppt] = await sql`
              SELECT id FROM appointments
              WHERE client_id = ${matchedClient.id} AND tenant_id = 1
              ORDER BY start_time DESC
              LIMIT 1
            `;

            if (recentAppt) {
              await sql`
                INSERT INTO sms_messages (
                  tenant_id, appointment_id, client_id, direction, phone, message, sender_name, sent_at, provider, segment_count
                ) VALUES (
                  1, ${recentAppt.id}, ${matchedClient.id}, 'inbound', ${fromPhone}, ${messageBody}, ${matchedClient.name}, ${receivedAt}, 'ClickSend', ${segmentCount}
                )
              `;
            } else {
              await sql`
                INSERT INTO sms_messages (
                  tenant_id, client_id, direction, phone, message, sender_name, sent_at, provider, segment_count
                ) VALUES (
                  1, ${matchedClient.id}, 'inbound', ${fromPhone}, ${messageBody}, ${matchedClient.name}, ${receivedAt}, 'ClickSend', ${segmentCount}
                )
              `;
            }
          } else {
            // Store message from unknown sender
            await sql`
              INSERT INTO sms_messages (
                tenant_id, direction, phone, message, sent_at, provider, segment_count
              ) VALUES (
                1, 'inbound', ${fromPhone}, ${messageBody}, ${receivedAt}, 'ClickSend', ${segmentCount}
              )
            `;
            console.log(
              `[ClickSend Webhook] Stored message from unknown sender: ${fromPhone}`,
            );
          }
        }

        console.log("[ClickSend Webhook] ✅ Message stored successfully");
        return Response.json({ received: true });
      } else {
        console.log(
          "[ClickSend Webhook] Could not parse ClickSend fields from payload",
        );
      }
    }

    // ── Quo Webhook ───────────────────────────────────────────────────────
    if (smsConfig.provider === "Quo") {
      const signingSecret = settings.quo_webhook_secret;

      if (signingSecret) {
        const sigHeader = request.headers.get("openphone-signature");
        if (!verifyQuoSignature(rawBody, sigHeader, signingSecret)) {
          console.error("[Quo Webhook] Signature verification failed");
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
      }

      let event;
      try {
        event = JSON.parse(rawBody);
      } catch {
        return Response.json({ error: "Invalid JSON" }, { status: 400 });
      }

      console.log(`[Quo Webhook] Received event: ${event.type}`);

      if (event.type === "message.received") {
        const msg = event.data?.object;
        if (!msg) return Response.json({ received: true });

        const fromPhone = normalizePhone(msg.from);
        const messageBody = (msg.body || "").trim();
        const receivedAt = msg.createdAt || new Date().toISOString();
        const segmentCount = calculateSegmentCount(messageBody);

        console.log(
          `[Quo Webhook] Inbound SMS from ${fromPhone}: "${messageBody}"`,
        );

        // ── Full conversation handling (same as ClickSend) ────────────────
        const conversation = await findConversationByPhone(fromPhone);

        if (conversation) {
          console.log(
            `[Quo Webhook] Found conversation ${conversation.id} for ${fromPhone}`,
          );

          const sender = conversation.participants.find(
            (p) => p.phone === fromPhone,
          );
          const senderName = sender?.name || "Unknown";
          const senderType = sender?.participant_type || "unknown";

          // Store inbound message with segment count
          // Guard: skip if same message already stored in the last 60s (webhook retry protection)
          const quoDupCheck = await isInboundDuplicate(fromPhone, messageBody);
          if (quoDupCheck) {
            console.log(
              `[Quo Webhook] Duplicate inbound message from ${fromPhone} — skipping insert`,
            );
            return Response.json({ received: true });
          }

          await sql`
            INSERT INTO sms_messages (
              tenant_id, conversation_id, appointment_id, client_id, direction, phone, message, sender_name, sent_at, provider, metadata, segment_count
            ) VALUES (
              1, ${conversation.id}, ${conversation.appointment_id}, ${sender?.client_id || null}, 'inbound', ${fromPhone}, ${messageBody}, ${senderName}, ${receivedAt}, 'Quo', ${JSON.stringify({ sender_type: senderType })}, ${segmentCount}
            )
          `;

          await updateConversationTimestamp(conversation.id);

          // ── KEYWORD DETECTION: Check for YES/NO confirmation/acceptance ───
          const keywordDetection = detectConfirmationKeyword(messageBody);
          if (keywordDetection.action) {
            console.log(
              `[Quo Webhook] Detected keyword: ${keywordDetection.action} (${keywordDetection.confidence} confidence)`,
            );

            await processKeywordResponse({
              appointmentId: conversation.appointment_id,
              senderType,
              senderName,
              action: keywordDetection.action,
              settings,
              smsConfig,
              senderPhone: fromPhone,
              conversationId: conversation.id,
            });
          }

          // Forward to all other participants via Quo
          const otherParticipants = await getOtherParticipants(
            conversation.id,
            fromPhone,
          );
          console.log(
            `[Quo Webhook] Forwarding to ${otherParticipants.length} other participants`,
          );

          const quoApiKey = settings.quo_api_key;
          const quoPhoneNumberId = settings.quo_phone_number_id;
          const quoUserId = settings.quo_user_id || null;

          if (quoApiKey && quoPhoneNumberId) {
            for (const participant of otherParticipants) {
              try {
                const forwardedMessage = `From ${senderName}: ${messageBody}`;

                await unifiedSendSms({
                  apiKey: quoApiKey,
                  phoneNumberId: quoPhoneNumberId,
                  userId: quoUserId,
                  to: participant.phone,
                  message: forwardedMessage,
                });

                await sql`
                  INSERT INTO sms_messages (
                    tenant_id, conversation_id, appointment_id, client_id, employee_id, direction, phone, message, sender_name, provider, metadata
                  ) VALUES (
                    1, ${conversation.id}, ${conversation.appointment_id}, ${participant.client_id || null}, ${participant.employee_id || null}, 'outbound', ${participant.phone}, ${forwardedMessage}, ${participant.name}, 'Quo', ${JSON.stringify({ forwarded_from: senderName, is_auto_forward: true })}
                  )
                `;

                console.log(
                  `[Quo Webhook] Forwarded message to ${participant.name} (${participant.phone})`,
                );
              } catch (forwardErr) {
                console.error(
                  `[Quo Webhook] Failed to forward to ${participant.phone}:`,
                  forwardErr,
                );
              }
            }

            // ── Driver copy: forward inbound passenger messages to owner ──────
            // TEMPORARILY DISABLED: Quo only delivers to 2 of 3 recipients simultaneously.
            // Removing company phone copy until Quo resolves this limitation.
            /*
            if (conversation.appointment_id && senderType === "passenger") {
              try {
                const ownerPhone = settings.business_phone;
                if (ownerPhone) {
                  const normalizedOwnerPhone = normalizePhone(ownerPhone);
                  const driverRows = await sql`
                    SELECT e.copy_communications_to_company, e.name AS driver_name
                    FROM appointments a
                    JOIN employees e ON a.employee_id = e.id
                    WHERE a.id = ${conversation.appointment_id}
                      AND e.copy_communications_to_company = true
                    LIMIT 1
                  `;
                  if (driverRows.length > 0) {
                    const driverName = driverRows[0].driver_name;
                    const ownerAlreadyForwarded = otherParticipants.some(
                      (p) => normalizePhone(p.phone) === normalizedOwnerPhone,
                    );
                    if (
                      !ownerAlreadyForwarded &&
                      normalizedOwnerPhone !== fromPhone
                    ) {
                      const copyMsg = `[COPY - Driver: ${driverName}] From ${senderName}: ${messageBody}`;
                      await unifiedSendSms({
                        apiKey: quoApiKey,
                        phoneNumberId: quoPhoneNumberId,
                        userId: quoUserId,
                        to: ownerPhone,
                        message: copyMsg,
                      });
                      await sql`
                        INSERT INTO sms_messages (
                          tenant_id, conversation_id, appointment_id, direction, phone, message, provider, metadata
                        ) VALUES (
                          1, ${conversation.id}, ${conversation.appointment_id}, 'outbound', ${normalizedOwnerPhone}, ${copyMsg}, 'Quo',
                          ${JSON.stringify({ forwarded_from: senderName, is_driver_copy: true, original_sender: "passenger" })}
                        )
                      `;
                      console.log(
                        `[Quo Webhook] Forwarded inbound passenger msg to owner ${ownerPhone} (driver copy for ${driverName})`,
                      );
                    }
                  }
                }
              } catch (copyErr) {
                console.error(
                  "[Quo Webhook] Failed to send driver copy to owner:",
                  copyErr.message,
                );
              }
            }
            */
          }
        } else {
          // No conversation — legacy client matching fallback
          console.log(
            `[Quo Webhook] No conversation found for ${fromPhone} - using legacy client matching`,
          );

          // Guard: skip if same message already stored in the last 60s (webhook retry protection)
          const quoLegacyDupCheck = await isInboundDuplicate(
            fromPhone,
            messageBody,
          );
          if (quoLegacyDupCheck) {
            console.log(
              `[Quo Webhook] Duplicate inbound message (legacy path) from ${fromPhone} — skipping insert`,
            );
            return Response.json({ received: true });
          }

          const clients =
            await sql`SELECT id, name, phone FROM clients WHERE tenant_id = 1`;
          const matchedClient = clients.find(
            (c) => c.phone && normalizePhone(c.phone) === fromPhone,
          );

          if (matchedClient) {
            const [recentAppt] = await sql`
              SELECT id FROM appointments
              WHERE client_id = ${matchedClient.id} AND tenant_id = 1
              ORDER BY start_time DESC
              LIMIT 1
            `;

            if (recentAppt) {
              await sql`
                INSERT INTO sms_messages (
                  tenant_id, appointment_id, client_id, direction, phone, message, sender_name, sent_at, provider, segment_count
                ) VALUES (
                  1, ${recentAppt.id}, ${matchedClient.id}, 'inbound', ${fromPhone}, ${messageBody}, ${matchedClient.name}, ${receivedAt}, 'Quo', ${segmentCount}
                )
              `;
            } else {
              await sql`
                INSERT INTO sms_messages (
                  tenant_id, client_id, direction, phone, message, sender_name, sent_at, provider, segment_count
                ) VALUES (
                  1, ${matchedClient.id}, 'inbound', ${fromPhone}, ${messageBody}, ${matchedClient.name}, ${receivedAt}, 'Quo', ${segmentCount}
                )
              `;
            }
          } else {
            await sql`
              INSERT INTO sms_messages (
                tenant_id, direction, phone, message, sent_at, provider, segment_count
              ) VALUES (
                1, 'inbound', ${fromPhone}, ${messageBody}, ${receivedAt}, 'Quo', ${segmentCount}
              )
            `;
          }
        }
      }

      if (event.type === "call.ringing") {
        const call = event.data?.object;
        console.log(
          `[Quo Webhook] Incoming call from ${call?.from} to ${call?.to}`,
        );
      }

      if (event.type === "call.completed") {
        const call = event.data?.object;
        console.log(
          `[Quo Webhook] Call completed: ${call?.direction} ${call?.from} → ${call?.to}, status: ${call?.status}`,
        );
      }
    }

    // Always return 200 quickly so provider doesn't retry
    return Response.json({ received: true });
  } catch (error) {
    console.error("[SMS Webhook] Unhandled error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
