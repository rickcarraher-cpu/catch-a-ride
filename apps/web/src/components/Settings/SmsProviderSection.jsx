import { MessageSquare, CheckCircle2, AlertCircle } from "lucide-react";

export function SmsProviderSection({ settings, handleUpdate }) {
  // Determine if the selected provider is configured
  const selectedProvider = settings?.sms_provider || "None";
  const isConfigured =
    selectedProvider === "None"
      ? null
      : selectedProvider === "Quo"
        ? settings?.quo_api_key && settings?.quo_phone_number_id
        : selectedProvider === "ClickSend"
          ? settings?.clicksend_username && settings?.clicksend_api_key
          : false;

  return (
    <section className="bg-white p-6 rounded-xl border border-gray-200 space-y-4">
      <div className="flex items-center gap-2 text-gray-900 mb-2">
        <MessageSquare size={18} className="text-blue-600" />
        <h2 className="font-semibold text-lg">SMS Provider</h2>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Provider
        </label>
        <select
          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
          value={settings?.sms_provider || "None"}
          onChange={(e) => handleUpdate("sms_provider", e.target.value)}
        >
          <option value="None">None</option>
          <option value="Quo">Quo (formerly OpenPhone)</option>
          <option value="ClickSend">ClickSend</option>
        </select>

        {/* Status indicator */}
        {selectedProvider !== "None" && (
          <div className="mt-2 flex items-center gap-2 text-sm">
            {isConfigured ? (
              <>
                <CheckCircle2 size={16} className="text-green-600" />
                <span className="text-green-700 font-medium">
                  Configured and ready
                </span>
              </>
            ) : (
              <>
                <AlertCircle size={16} className="text-amber-600" />
                <span className="text-amber-700 font-medium">
                  Missing credentials — configure {selectedProvider} settings
                  below
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Auto-delete threads on completion */}
      <div className="pt-3 border-t border-gray-200">
        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            className="mt-0.5 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-600"
            checked={settings?.sms_auto_delete_on_complete === "true"}
            onChange={(e) =>
              handleUpdate(
                "sms_auto_delete_on_complete",
                e.target.checked ? "true" : "false",
              )
            }
          />
          <div className="flex-1">
            <span className="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
              Auto-delete SMS threads when trip is marked "Completed"
            </span>
            <p className="text-xs text-gray-500 mt-1">
              When enabled, all SMS messages for a trip will be automatically
              deleted when the trip status is changed to "Completed"
            </p>
          </div>
        </label>
      </div>
    </section>
  );
}
