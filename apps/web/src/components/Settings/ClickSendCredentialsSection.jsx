import { useState } from "react";
import {
  ExternalLink,
  Eye,
  EyeOff,
  Copy,
  Send,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import { toast } from "@/utils/notify";
import { useQueryClient } from "@tanstack/react-query";

export function ClickSendCredentialsSection({ settings, handleUpdate }) {
  const queryClient = useQueryClient();
  const [showApiKey, setShowApiKey] = useState(false);
  // Local state for controlled inputs — initialized from settings
  const [username, setUsername] = useState(settings?.clicksend_username || "");
  const [apiKey, setApiKey] = useState(settings?.clicksend_api_key || "");
  const [fromNumber, setFromNumber] = useState(
    settings?.clicksend_from || "+18335232872",
  );
  const [isSaving, setIsSaving] = useState(false);

  // Check if credentials are actually saved in the DB
  const hasUsername = !!settings?.clicksend_username;
  const hasApiKey = !!settings?.clicksend_api_key;
  const credentialsSaved = hasUsername && hasApiKey;

  // Check if there are unsaved changes
  const hasChanges =
    username !== (settings?.clicksend_username || "") ||
    apiKey !== (settings?.clicksend_api_key || "") ||
    fromNumber !== (settings?.clicksend_from || "+18335232872");

  const webhookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/sms/webhook`
      : "/api/sms/webhook";

  const copyWebhookUrl = () => {
    if (typeof navigator !== "undefined") {
      navigator.clipboard.writeText(webhookUrl);
      toast.success("Webhook URL copied!");
    }
  };

  const handleSaveCredentials = async () => {
    if (!username.trim() || !apiKey.trim()) {
      toast.error("Both username and API key are required");
      return;
    }

    setIsSaving(true);
    try {
      // Save all three fields
      await handleUpdate("clicksend_username", username.trim());
      await handleUpdate("clicksend_api_key", apiKey.trim());
      await handleUpdate("clicksend_from", fromNumber.trim());

      toast.success("✅ ClickSend credentials saved successfully!", {
        description: "SMS is now configured and ready to send messages",
        duration: 4000,
      });

      // Refresh settings query to update the status banner — no page reload needed
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["settings"] });
      }, 500);
    } catch (error) {
      toast.error("Failed to save credentials. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      {/* API Credentials */}
      <section className="bg-white p-6 rounded-xl border border-gray-200 space-y-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-gray-900">
            <h2 className="font-semibold text-lg">ClickSend API Credentials</h2>
          </div>
          <a
            href="https://dashboard.clicksend.com/account/subaccounts"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
          >
            ClickSend Dashboard <ExternalLink size={12} />
          </a>
        </div>

        {/* Status Banner */}
        {credentialsSaved ? (
          <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
            <CheckCircle size={16} className="text-green-600 flex-shrink-0" />
            <span className="text-sm text-green-800 font-medium">
              Credentials saved — SMS is ready
            </span>
          </div>
        ) : (
          <div className="flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
            <AlertTriangle
              size={16}
              className="text-red-600 flex-shrink-0 mt-0.5"
            />
            <div>
              <span className="text-sm text-red-800 font-medium">
                ClickSend credentials are missing — SMS will not send
              </span>
              <p className="text-xs text-red-600 mt-0.5">
                {!hasUsername && !hasApiKey
                  ? "Enter your username and API key below, then click Save."
                  : !hasUsername
                    ? "Username is missing. Enter it below and click Save."
                    : "API key is missing. Enter it below and click Save."}
              </p>
            </div>
          </div>
        )}

        <p className="text-xs text-gray-500 -mt-2">
          Generate API credentials in{" "}
          <strong>ClickSend Dashboard → Account → API Credentials</strong>.
        </p>

        {/* Username */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Username
          </label>
          <input
            type="text"
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="your-clicksend-username"
          />
        </div>

        {/* API Key */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            API Key
          </label>
          <div className="relative">
            <input
              type={showApiKey ? "text" : "password"}
              className="w-full px-3 py-2 pr-10 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="your-clicksend-api-key"
            />
            <button
              type="button"
              onClick={() => setShowApiKey((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* From (Sender ID) */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            From (Sender ID / Dedicated Number)
          </label>
          <input
            type="text"
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
            value={fromNumber}
            onChange={(e) => setFromNumber(e.target.value)}
            placeholder="+18335232872"
          />
          <p className="text-xs text-gray-400">
            Use your dedicated phone number (e.g. +18335232872) so passengers
            can reply.
          </p>
          {fromNumber && !/^\+?\d/.test(fromNumber) && (
            <div className="mt-1 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
              <strong>⚠️ Alpha tags can't receive replies.</strong> Passengers
              won't be able to text back to "{fromNumber}". Use your dedicated
              number instead so replies work.
            </div>
          )}
        </div>

        {/* Save Button */}
        <div className="pt-4 border-t border-gray-200">
          <button
            onClick={handleSaveCredentials}
            disabled={isSaving || !hasChanges}
            className={`w-full px-4 py-3 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
              hasChanges && !isSaving
                ? "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
            }`}
          >
            <Send size={16} />
            {isSaving
              ? "Saving..."
              : hasChanges
                ? "Save ClickSend Settings"
                : "No Changes to Save"}
          </button>
          {hasChanges && (
            <p className="text-xs text-amber-600 mt-2 text-center">
              ⚠️ You have unsaved changes
            </p>
          )}
        </div>
      </section>

      {/* Inbound SMS / Webhooks */}
      <section className="bg-white p-6 rounded-xl border border-gray-200 space-y-4">
        <div className="flex items-center gap-2 text-gray-900 mb-2">
          <h2 className="font-semibold text-lg">Inbound SMS (Webhooks)</h2>
        </div>
        <p className="text-xs text-gray-500 -mt-2">
          Configure this in{" "}
          <strong>ClickSend Dashboard → SMS → Inbound SMS → Webhooks</strong>.
          Set the webhook URL below and choose POST format.
        </p>

        {/* Webhook URL display */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Your Webhook URL
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={webhookUrl}
              className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono text-gray-600 select-all"
            />
            <button
              onClick={copyWebhookUrl}
              className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500"
              title="Copy URL"
            >
              <Copy size={16} />
            </button>
          </div>
          <p className="text-xs text-gray-400">
            Paste this URL into ClickSend's inbound SMS webhook configuration.
            Inbound passenger replies will be logged to their trip notes.
          </p>
        </div>
      </section>

      {/* SMS Message Templates */}
      <section className="bg-white p-6 rounded-xl border border-gray-200 space-y-4">
        <div className="flex items-center gap-2 text-gray-900 mb-2">
          <h2 className="font-semibold text-lg">SMS Message Templates</h2>
        </div>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Confirmation Message
            </label>
            <textarea
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 min-h-[100px]"
              defaultValue={
                settings?.sms_confirmation_message ||
                "Hi {name}, your trip with {business} is confirmed for {date} at {time}. Driver: {driver}. Booking Code: #{code}.\n\nShow Booking Details: {link}\n\nReply with any questions."
              }
              onBlur={(e) =>
                handleUpdate("sms_confirmation_message", e.target.value)
              }
            />
            <p className="text-xs text-gray-400">
              Sent when a trip is confirmed. Variables:{" "}
              <code className="bg-gray-100 px-1 rounded">{"{name}"}</code>{" "}
              <code className="bg-gray-100 px-1 rounded">{"{business}"}</code>{" "}
              <code className="bg-gray-100 px-1 rounded">{"{date}"}</code>{" "}
              <code className="bg-gray-100 px-1 rounded">{"{time}"}</code>{" "}
              <code className="bg-gray-100 px-1 rounded">{"{driver}"}</code>{" "}
              <code className="bg-gray-100 px-1 rounded">{"{code}"}</code>{" "}
              <code className="bg-gray-100 px-1 rounded">{"{link}"}</code>
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Day-Before Reminder
            </label>
            <textarea
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 min-h-[100px]"
              defaultValue={
                settings?.sms_reminder_message ||
                "Hi {name}, reminder: your trip with {business} is tomorrow at {time}. Driver: {driver}. Booking #{code}.\n\nShow Details: {link}"
              }
              onBlur={(e) =>
                handleUpdate("sms_reminder_message", e.target.value)
              }
            />
            <p className="text-xs text-gray-400">
              Sent 1 day before the trip. Same variables as confirmation.
            </p>
          </div>
        </div>
      </section>

      {/* Test SMS (reuse existing TestSmsSection component) */}
    </>
  );
}
