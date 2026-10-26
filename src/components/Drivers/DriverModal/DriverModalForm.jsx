import { useState } from "react";
import { PALETTE } from "@/utils/drivers/colorPalette";

export function DriverModalForm({
  formData,
  setFormData,
  handleNameChange,
  usedColors,
}) {
  const [showPasswordInput, setShowPasswordInput] = useState(false);

  return (
    <>
      {/* First Name and Last Name - separate fields */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            First Name *
          </label>
          <input
            type="text"
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
            value={formData.first_name}
            onChange={(e) =>
              handleNameChange(e.target.value, formData.last_name)
            }
            placeholder="e.g. John"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Last Name *
          </label>
          <input
            type="text"
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
            value={formData.last_name}
            onChange={(e) =>
              handleNameChange(formData.first_name, e.target.value)
            }
            placeholder="e.g. Doe"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Email
          </label>
          <input
            type="email"
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
            value={formData.email}
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
            placeholder="john@example.com"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Phone
          </label>
          <input
            type="tel"
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
            value={formData.phone}
            onChange={(e) =>
              setFormData({ ...formData, phone: e.target.value })
            }
            placeholder="(555) 000-0000"
          />
        </div>
      </div>

      {/* Address - structured fields */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Address
        </label>
        <div className="space-y-2">
          <input
            type="text"
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
            value={formData.street_address}
            onChange={(e) =>
              setFormData({ ...formData, street_address: e.target.value })
            }
            placeholder="Street address (e.g. 123 Main St)"
          />
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <input
                type="text"
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
                value={formData.city}
                onChange={(e) =>
                  setFormData({ ...formData, city: e.target.value })
                }
                placeholder="City"
              />
            </div>
            <div>
              <input
                type="text"
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
                value={formData.state}
                onChange={(e) =>
                  setFormData({ ...formData, state: e.target.value })
                }
                placeholder="State"
                maxLength={2}
              />
            </div>
          </div>
          <input
            type="text"
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
            value={formData.zip_code}
            onChange={(e) =>
              setFormData({ ...formData, zip_code: e.target.value })
            }
            placeholder="ZIP code"
          />
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Notes
        </label>
        <textarea
          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 resize-none"
          rows={2}
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Any notes about this driver..."
        />
      </div>

      {/* Access Section */}
      <div className="space-y-3 pt-4 border-t border-gray-200">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Access
        </label>

        <div className="space-y-3 bg-gray-50 p-4 rounded-lg border border-gray-200">
          {/* Admin Access Checkbox */}
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="is_admin"
              checked={formData.is_admin || false}
              onChange={(e) =>
                setFormData({ ...formData, is_admin: e.target.checked })
              }
              className="w-4 h-4 mt-0.5 text-blue-600 border-gray-300 rounded focus:ring-blue-600"
            />
            <label
              htmlFor="is_admin"
              className="text-sm font-medium text-gray-700 cursor-pointer leading-snug"
            >
              Administrator Access
              <p className="text-xs text-gray-400 font-normal mt-0.5">
                Can access admin dashboard and dispatcher tools
              </p>
            </label>
          </div>

          {/* Password Management */}
          <div className="pt-3 border-t border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Password
              </span>
              <span className="text-xs text-gray-400">
                {formData.password ? "✅ Password set" : "⚠️ No password"}
              </span>
            </div>

            {!showPasswordInput ? (
              <button
                type="button"
                onClick={() => setShowPasswordInput(true)}
                className="w-full text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg px-3 py-2 transition-colors"
              >
                {formData.password ? "Reset Password" : "Set Password"}
              </button>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Enter new password"
                  value={formData.new_password || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, new_password: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordInput(false);
                      setFormData({ ...formData, new_password: "" });
                    }}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Cancel
                  </button>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Password will be saved when you click Update Driver
                  </p>
                </div>
              </div>
            )}

            {/* Force Password Reset */}
            <div className="flex items-start gap-3 mt-3">
              <input
                type="checkbox"
                id="force_password_reset"
                checked={formData.force_password_reset || false}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    force_password_reset: e.target.checked,
                  })
                }
                className="w-4 h-4 mt-0.5 text-orange-600 border-gray-300 rounded focus:ring-orange-600"
              />
              <label
                htmlFor="force_password_reset"
                className="text-sm font-medium text-gray-700 cursor-pointer leading-snug"
              >
                Force password reset on next login
                <p className="text-xs text-gray-400 font-normal mt-0.5">
                  Driver will be required to change password when they next sign
                  in
                </p>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Commission */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Commission Rate (%)
        </label>
        <input
          type="number"
          step="1"
          min="0"
          max="100"
          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
          value={Math.round(formData.salary_rate * 100)}
          onChange={(e) =>
            setFormData({
              ...formData,
              salary_rate: Number(e.target.value) / 100,
            })
          }
        />
        <p className="text-[11px] text-gray-400">
          Defaults: New drivers 75% · Existing 80% · Lisa K 100%
        </p>
      </div>

      {/* Hourly Rate - NEW */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Hourly Rate ($/hour)
        </label>
        <input
          type="number"
          step="0.01"
          min="0"
          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
          value={formData.hourly_rate || ""}
          onChange={(e) =>
            setFormData({
              ...formData,
              hourly_rate: e.target.value ? parseFloat(e.target.value) : null,
            })
          }
          placeholder="Optional (e.g. 15.00)"
        />
        <p className="text-[11px] text-gray-400">
          Optional: Hourly wage for non-trip time (admin tasks, waiting, etc.).
          Leave blank for commission-only compensation.
        </p>
      </div>

      {/* ADP Worker ID */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          ADP Worker ID
        </label>
        <input
          type="text"
          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
          value={formData.adp_worker_id || ""}
          onChange={(e) =>
            setFormData({ ...formData, adp_worker_id: e.target.value })
          }
          placeholder="e.g. EMP-12345 (optional)"
        />
        <p className="text-[11px] text-gray-400">
          Optional: ADP Worker ID for payroll integration. If blank, uses
          database ID.
        </p>
      </div>

      {/* Calendar colour picker */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Calendar Color
          </label>
          <span className="flex items-center gap-1.5 text-xs text-gray-500">
            <span
              className="inline-block w-3.5 h-3.5 rounded-full border border-white shadow"
              style={{ backgroundColor: formData.color }}
            />
            <span className="font-mono uppercase">{formData.color}</span>
          </span>
        </div>
        <div className="grid grid-cols-10 gap-1.5 p-3 bg-gray-50 rounded-xl border border-gray-100">
          {PALETTE.map((hex) => {
            const taken = usedColors.has(hex.toLowerCase());
            const selected = formData.color.toLowerCase() === hex.toLowerCase();
            return (
              <button
                key={hex}
                type="button"
                disabled={taken}
                title={taken ? "Already assigned" : hex}
                onClick={() => setFormData({ ...formData, color: hex })}
                className="relative w-7 h-7 rounded-full border-2 transition-all focus:outline-none"
                style={{
                  backgroundColor: taken ? "#e5e7eb" : hex,
                  borderColor: selected ? "#1e293b" : "transparent",
                  opacity: taken ? 0.4 : 1,
                  cursor: taken ? "not-allowed" : "pointer",
                  transform: selected ? "scale(1.2)" : "scale(1)",
                }}
              >
                {selected && (
                  <span className="absolute inset-0 flex items-center justify-center text-white text-[10px] font-black">
                    ✓
                  </span>
                )}
                {taken && !selected && (
                  <span className="absolute inset-0 flex items-center justify-center text-gray-400 text-[10px] font-black">
                    ✕
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-gray-400">
          Greyed-out colors are already assigned to another driver.
        </p>
      </div>

      <div className="flex items-center gap-2 py-1">
        <input
          type="checkbox"
          id="active"
          checked={formData.is_active}
          onChange={(e) =>
            setFormData({ ...formData, is_active: e.target.checked })
          }
          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-600"
        />
        <label
          htmlFor="active"
          className="text-sm font-medium text-gray-700 cursor-pointer"
        >
          Active and accepting trips
        </label>
      </div>

      {/* Copy communications to company */}
      <div className="flex items-start gap-3 py-1">
        <input
          type="checkbox"
          id="copy_comms"
          checked={formData.copy_communications_to_company}
          onChange={(e) =>
            setFormData({
              ...formData,
              copy_communications_to_company: e.target.checked,
            })
          }
          className="w-4 h-4 mt-0.5 text-blue-600 border-gray-300 rounded focus:ring-blue-600"
        />
        <label
          htmlFor="copy_comms"
          className="text-sm font-medium text-gray-700 cursor-pointer leading-snug"
        >
          Copy all passenger communications to company
          <p className="text-xs text-gray-400 font-normal mt-0.5">
            All emails and texts to/from this driver&apos;s passengers will also
            be sent to the company owner.
          </p>
        </label>
      </div>

      {/* Can cancel trips permission */}
      <div className="flex items-start gap-3 py-1">
        <input
          type="checkbox"
          id="can_cancel_trip"
          checked={formData.can_cancel_trip}
          onChange={(e) =>
            setFormData({
              ...formData,
              can_cancel_trip: e.target.checked,
            })
          }
          className="w-4 h-4 mt-0.5 text-blue-600 border-gray-300 rounded focus:ring-blue-600"
        />
        <label
          htmlFor="can_cancel_trip"
          className="text-sm font-medium text-gray-700 cursor-pointer leading-snug"
        >
          Can cancel trips
          <p className="text-xs text-gray-400 font-normal mt-0.5">
            This driver can cancel/delete trips from the system.
          </p>
        </label>
      </div>
    </>
  );
}
