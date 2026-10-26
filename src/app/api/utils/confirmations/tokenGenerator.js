/**
 * Confirmation Token Generator
 * Centralized token generation for passenger and driver confirmations
 */

import { randomBytes } from "crypto";
import sql from "@/app/api/utils/sql";

/**
 * Generates a secure random token
 */
export function generateToken() {
  return randomBytes(32).toString("hex");
}

/**
 * Ensures passenger confirmation token exists
 * Generates and stores if missing, returns existing if present
 */
export async function ensurePassengerToken(appointmentId) {
  const [trip] = await sql`
    SELECT id, passenger_confirmation_token, passenger_response_at
    FROM appointments
    WHERE id = ${appointmentId}
  `;

  if (!trip) {
    throw new Error(`Appointment ${appointmentId} not found`);
  }

  // If already has token, return it
  if (trip.passenger_confirmation_token) {
    return trip.passenger_confirmation_token;
  }

  // Generate new token
  const token = generateToken();
  await sql`
    UPDATE appointments
    SET passenger_confirmation_token = ${token}
    WHERE id = ${appointmentId}
  `;

  return token;
}

/**
 * Ensures driver confirmation token exists
 * Generates and stores if missing, returns existing if present
 */
export async function ensureDriverToken(appointmentId) {
  const [trip] = await sql`
    SELECT id, driver_confirmation_token, driver_response_at
    FROM appointments
    WHERE id = ${appointmentId}
  `;

  if (!trip) {
    throw new Error(`Appointment ${appointmentId} not found`);
  }

  // If already has token, return it
  if (trip.driver_confirmation_token) {
    return trip.driver_confirmation_token;
  }

  // Generate new token
  const token = generateToken();
  await sql`
    UPDATE appointments
    SET driver_confirmation_token = ${token}
    WHERE id = ${appointmentId}
  `;

  return token;
}

/**
 * Ensures both tokens exist (for comprehensive confirmations)
 */
export async function ensureAllTokens(appointmentId) {
  const passengerToken = await ensurePassengerToken(appointmentId);
  const driverToken = await ensureDriverToken(appointmentId);

  return {
    passengerToken,
    driverToken,
  };
}

/**
 * Regenerates passenger token (for reassignment scenarios)
 */
export async function regeneratePassengerToken(appointmentId) {
  const token = generateToken();
  await sql`
    UPDATE appointments
    SET 
      passenger_confirmation_token = ${token},
      passenger_confirmed = 'pending',
      passenger_response_at = NULL,
      passenger_cancelled_reason = NULL
    WHERE id = ${appointmentId}
  `;
  return token;
}

/**
 * Regenerates driver token (for reassignment scenarios)
 */
export async function regenerateDriverToken(appointmentId) {
  const token = generateToken();
  await sql`
    UPDATE appointments
    SET 
      driver_confirmation_token = ${token},
      driver_accepted = 'pending',
      driver_response_at = NULL,
      driver_declined_reason = NULL
    WHERE id = ${appointmentId}
  `;
  return token;
}
