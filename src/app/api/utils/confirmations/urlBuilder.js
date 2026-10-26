/**
 * URL Builder
 * Builds and shortens all confirmation URLs for a trip
 */

import { getBaseUrl } from "./settingsHelpers.js";
import { shortenUrls } from "./urlShortener.js";

/**
 * Build all confirmation URLs for a trip
 */
export async function buildConfirmationUrls(
  appointmentId,
  passengerToken,
  driverToken,
  paymentUrl,
) {
  const BASE_URL = await getBaseUrl();

  console.log(
    `[buildConfirmationUrls] Building URLs for appointment ${appointmentId}:`,
  );
  console.log(`  - BASE_URL: ${BASE_URL}`);
  console.log(`  - passengerToken: ${passengerToken ? "SET" : "NULL"}`);
  console.log(`  - driverToken: ${driverToken ? "SET" : "NULL"}`);
  console.log(`  - paymentUrl: ${paymentUrl ? "SET" : "NULL"}`);

  const longUrls = {
    tripDetails: `${BASE_URL}/booking/${appointmentId}`,
    passengerConfirm: passengerToken
      ? `${BASE_URL}/passenger/confirm/${passengerToken}`
      : null,
    driverConfirm: driverToken
      ? `${BASE_URL}/driver/confirm/${driverToken}`
      : null,
    // New combined pages — single link with all functions
    passengerTrip: passengerToken
      ? `${BASE_URL}/passenger/trip/${passengerToken}`
      : null,
    driverTrip: driverToken ? `${BASE_URL}/driver/trip/${driverToken}` : null,
    calendar: `${BASE_URL}/api/appointments/${appointmentId}/ics`,
    passengerCalendar: passengerToken
      ? `${BASE_URL}/api/appointments/${appointmentId}/ics?recipient=passenger`
      : null,
    driverCalendar: driverToken
      ? `${BASE_URL}/api/appointments/${appointmentId}/ics?recipient=driver`
      : null,
    paymentLink: paymentUrl || null,
  };

  console.log(
    `[buildConfirmationUrls] Passenger confirm URL (before shortening): ${longUrls.passengerConfirm}`,
  );
  console.log(
    `[buildConfirmationUrls] Driver confirm URL (before shortening): ${longUrls.driverConfirm}`,
  );

  // Shorten all URLs
  const shortUrls = await shortenUrls(longUrls);

  console.log(
    `[buildConfirmationUrls] Passenger confirm URL (after shortening): ${shortUrls.passengerConfirm}`,
  );
  console.log(
    `[buildConfirmationUrls] Driver confirm URL (after shortening): ${shortUrls.driverConfirm}`,
  );
  console.log(
    `[buildConfirmationUrls] Payment link (after shortening): ${shortUrls.paymentLink}`,
  );

  return shortUrls;
}
