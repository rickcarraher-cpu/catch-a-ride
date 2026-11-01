import { Phone } from "lucide-react";
import { SettingInput } from "./SettingInput";

/**
 * Contact Phone Numbers Section
 * Sets the Reservation Number ID and Non Reservation Number ID used
 * in advisory text appended to all confirmation emails and SMS messages.
 */
export function ContactPhoneNumbersSection({ settings, handleUpdate }) {
  const reservationNumber = settings?.["Reservation Number ID"] || "";
  const nonReservationNumber = settings?.["Non Reservation Number ID"] || "";

  const previewText =
    nonReservationNumber || reservationNumber
      ? `For normal communications (non-urgent), please use ${nonReservationNumber || "[Non Reservation Number]"}. For urgent reasons, please call or text ${reservationNumber || "[Reservation Number]"}.`
      : null;

  return (
    <section className="bg-white p-6 rounded-xl border border-gray-200 space-y-4">
      <div className="flex items-center gap-2 text-gray-900 mb-2">
        <Phone size={18} className="text-blue-600" />
        <h2 className="font-semibold text-lg">Contact Phone Numbers</h2>
      </div>

      <p className="text-sm text-gray-500">
        These numbers appear as an advisory in{" "}
        <strong>all confirmation emails and SMS</strong> sent to passengers,
        drivers, and the office.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <SettingInput
            label="Non-Reservation Number (non-urgent)"
            value={nonReservationNumber}
            onSave={(v) => handleUpdate("Non Reservation Number ID", v)}
            placeholder="e.g. 615-555-0100"
          />
          <p className="text-xs text-gray-400 mt-1">
            For general / non-urgent inquiries
          </p>
        </div>
        <div>
          <SettingInput
            label="Reservation Number (urgent)"
            value={reservationNumber}
            onSave={(v) => handleUpdate("Reservation Number ID", v)}
            placeholder="e.g. 615-555-0199"
          />
          <p className="text-xs text-gray-400 mt-1">
            For urgent calls or texts only
          </p>
        </div>
      </div>

      {previewText && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-2">
          <p className="text-xs font-semibold text-blue-700 mb-1">
            📞 Advisory Preview
          </p>
          <p className="text-sm text-blue-800">{previewText}</p>
        </div>
      )}

      {!previewText && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mt-2">
          <p className="text-xs text-gray-500">
            Enter at least one phone number above to enable the advisory. The
            advisory will be hidden from confirmations until numbers are set.
          </p>
        </div>
      )}
    </section>
  );
}
