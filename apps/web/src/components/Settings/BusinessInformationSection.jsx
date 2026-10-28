import { Building } from "lucide-react";
import { SettingInput } from "./SettingInput";

export function BusinessInformationSection({ settings, handleUpdate }) {
  return (
    <section className="bg-white p-6 rounded-xl border border-gray-200 space-y-4">
      <div className="flex items-center gap-2 text-gray-900 mb-2">
        <Building size={18} className="text-blue-600" />
        <h2 className="font-semibold text-lg">Business Information</h2>
      </div>

      {/* ── Bypass Dashboard Login Toggle ────────────────────────── */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-200">
        <div>
          <p className="text-sm font-medium text-gray-700">
            Bypass Dashboard Login
          </p>
          <p className="text-xs text-gray-400">
            Skip authentication for testing (disable in production)
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            handleUpdate(
              "bypass_dashboard_login",
              settings?.bypass_dashboard_login === "yes" ? "no" : "yes",
            )
          }
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            settings?.bypass_dashboard_login === "yes"
              ? "bg-orange-500"
              : "bg-gray-300"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              settings?.bypass_dashboard_login === "yes"
                ? "translate-x-6"
                : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {/* ── Bypass Driver Login Toggle ────────────────────────── */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-200">
        <div>
          <p className="text-sm font-medium text-gray-700">
            Bypass Driver Login
          </p>
          <p className="text-xs text-gray-400">
            Skip driver authentication for testing (disable in production)
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            handleUpdate(
              "bypass_driver_login",
              settings?.bypass_driver_login === "yes" ? "no" : "yes",
            )
          }
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            settings?.bypass_driver_login === "yes"
              ? "bg-orange-500"
              : "bg-gray-300"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              settings?.bypass_driver_login === "yes"
                ? "translate-x-6"
                : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {/* ── Feature Toggles ──────────────────────────────────── */}
      <div className="pb-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Feature Toggles
        </p>

        {/* Enable Tours */}
        <div className="flex items-center justify-between py-3 border-b border-gray-100">
          <div>
            <p className="text-sm font-medium text-gray-700">Enable Tours</p>
            <p className="text-xs text-gray-400">
              Show the Tour Agent portal on the dashboard
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              handleUpdate(
                "enable_tours",
                settings?.enable_tours === "no" ? "yes" : "no",
              )
            }
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              settings?.enable_tours !== "no" ? "bg-blue-600" : "bg-gray-300"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                settings?.enable_tours !== "no"
                  ? "translate-x-6"
                  : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {/* Enable Weddings */}
        <div className="flex items-center justify-between py-3 border-b border-gray-100">
          <div>
            <p className="text-sm font-medium text-gray-700">Enable Weddings</p>
            <p className="text-xs text-gray-400">
              Show the Wedding Packages section on the dashboard
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              handleUpdate(
                "enable_weddings",
                settings?.enable_weddings === "no" ? "yes" : "no",
              )
            }
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              settings?.enable_weddings !== "no" ? "bg-blue-600" : "bg-gray-300"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                settings?.enable_weddings !== "no"
                  ? "translate-x-6"
                  : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {/* Enable Third-Party Trips */}
        <div className="flex items-center justify-between py-3 border-b border-gray-100">
          <div>
            <p className="text-sm font-medium text-gray-700">
              Enable Third-Party Trips
            </p>
            <p className="text-xs text-gray-400">
              Show the Partner / 3rd-party drive workflow on the dashboard
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              handleUpdate(
                "enable_third_party_trips",
                settings?.enable_third_party_trips === "yes" ? "no" : "yes",
              )
            }
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              settings?.enable_third_party_trips === "yes"
                ? "bg-blue-600"
                : "bg-gray-300"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                settings?.enable_third_party_trips === "yes"
                  ? "translate-x-6"
                  : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SettingInput
          label="Shop Name"
          value={settings?.business_name}
          onSave={(v) => handleUpdate("business_name", v)}
        />
        <SettingInput
          label="Provider Label (e.g. Driver)"
          value={settings?.provider_label}
          onSave={(v) => handleUpdate("provider_label", v)}
        />
        <SettingInput
          label="Business Phone"
          value={settings?.business_phone}
          onSave={(v) => handleUpdate("business_phone", v)}
        />
        <SettingInput
          label="Owner Email"
          value={settings?.owner_email}
          onSave={(v) => handleUpdate("owner_email", v)}
        />

        {/* NEW: Additional Owner Emails */}
        <div className="md:col-span-2">
          <SettingInput
            label="Additional Owner Emails (comma-separated)"
            value={settings?.additional_owner_emails}
            onSave={(v) => handleUpdate("additional_owner_emails", v)}
            placeholder="admin@example.com, manager@example.com"
          />
          <p className="text-xs text-gray-400 mt-1">
            All addresses will receive separate copies of booking confirmations
            and updates
          </p>
        </div>

        {/* NEW: Business Hours */}
        <div className="md:col-span-2">
          <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-700">
                Business Hours
              </span>
              <span className="text-xs text-gray-400">
                (used for after-hours notifications)
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  Opening Time
                </label>
                <input
                  type="time"
                  defaultValue={settings?.business_hours_start || "06:00"}
                  onBlur={(e) =>
                    handleUpdate("business_hours_start", e.target.value)
                  }
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  Closing Time
                </label>
                <input
                  type="time"
                  defaultValue={settings?.business_hours_end || "22:00"}
                  onBlur={(e) =>
                    handleUpdate("business_hours_end", e.target.value)
                  }
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>
            </div>
            <p className="text-xs text-gray-400">
              Same hours apply all 7 days. An SMS is sent to the business phone
              when passengers submit outside these hours.
            </p>
          </div>
        </div>

        <div className="md:col-span-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <SettingInput
                label="From Name — e.g. Catch A Ride"
                value={settings?.from_name}
                onSave={(v) => handleUpdate("from_name", v)}
                placeholder="Catch A Ride"
              />
              <p className="text-xs text-gray-400 mt-1">
                Sender name shown in the recipient's inbox.
              </p>
            </div>
            <div>
              <SettingInput
                label="From Email (Resend) — e.g. bookings@yourdomain.com"
                value={settings?.from_email}
                onSave={(v) => handleUpdate("from_email", v)}
                placeholder="bookings@yourdomain.com"
              />
              <p className="text-xs text-gray-400 mt-1">
                Must be a verified domain in your Resend account. Leave blank to
                use the default sender.
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Business Address
        </label>
        <textarea
          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
          defaultValue={settings?.business_address}
          onBlur={(e) => handleUpdate("business_address", e.target.value)}
        />
      </div>
    </section>
  );
}
