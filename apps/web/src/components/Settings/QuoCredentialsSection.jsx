import { useState, useEffect, useCallback, useRef } from "react";
import {
  ExternalLink,
  Eye,
  EyeOff,
  Copy,
  AlertTriangle,
  Search,
  Loader,
  Save,
  CheckCircle2,
} from "lucide-react";
import { toast } from "@/utils/notify";

export function QuoCredentialsSection({ settings, handleUpdate }) {
  const [showQuoKey, setShowQuoKey] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupLoadingNonRes, setLookupLoadingNonRes] = useState(false);
  const [phoneNumbers, setPhoneNumbers] = useState([]);
  const [phoneNumbersNonRes, setPhoneNumbersNonRes] = useState([]);
  const [lookupError, setLookupError] = useState(null);
  const [lookupErrorNonRes, setLookupErrorNonRes] = useState(null);

  // Controlled state for credential fields
  const [apiKey, setApiKey] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [nonReservationPhoneNumberId, setNonReservationPhoneNumberId] =
    useState("");
  const [userId, setUserId] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [confirmationTemplate, setConfirmationTemplate] = useState("");

  // Track which fields have unsaved changes
  const [dirty, setDirty] = useState({});

  // Track whether we've done the initial sync from settings
  const initialSyncDone = useRef(false);

  // Sync local state when settings FIRST load from server (one-time only)
  useEffect(() => {
    if (settings && !initialSyncDone.current) {
      initialSyncDone.current = true;
      setApiKey(settings.quo_api_key || "");
      setPhoneNumberId(settings.quo_phone_number_id || "");
      setNonReservationPhoneNumberId(
        settings.quo_non_reservation_phone_number_id || "",
      );
      setUserId(settings.quo_user_id || "");
      setWebhookSecret(settings.quo_webhook_secret || "");
      setConfirmationTemplate(
        settings.sms_confirmation_message ||
          "Hi {name}, your trip with {business} is scheduled for {date}. Reply to this message with any questions.",
      );
      setDirty({});
    }
  }, [settings]);

  const updateField = useCallback((field, value, setter) => {
    setter(value);
    setDirty((prev) => ({ ...prev, [field]: true }));
  }, []);

  const saveField = useCallback(
    (field, value) => {
      handleUpdate(field, value);
      setDirty((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    },
    [handleUpdate],
  );

  const saveAllCredentials = useCallback(() => {
    // Always save all credential fields, regardless of dirty state
    const fieldsToSave = [
      { key: "quo_api_key", value: apiKey },
      { key: "quo_phone_number_id", value: phoneNumberId },
      {
        key: "quo_non_reservation_phone_number_id",
        value: nonReservationPhoneNumberId,
      },
      { key: "quo_user_id", value: userId },
      { key: "quo_webhook_secret", value: webhookSecret },
      { key: "sms_confirmation_message", value: confirmationTemplate },
    ];

    const nonEmptyFields = fieldsToSave.filter(
      (f) => f.value && f.value.trim(),
    );
    if (nonEmptyFields.length === 0) {
      toast.error("Please enter at least an API Key and Phone Number ID");
      return;
    }

    nonEmptyFields.forEach((f) => {
      handleUpdate(f.key, f.value);
    });

    setDirty({});
    toast.success(`Saved ${nonEmptyFields.length} Quo settings!`);
  }, [
    apiKey,
    phoneNumberId,
    nonReservationPhoneNumberId,
    userId,
    webhookSecret,
    confirmationTemplate,
    handleUpdate,
  ]);

  const hasDirtyFields = Object.keys(dirty).length > 0;

  // Check if credentials are actually present in the DB (loaded via settings)
  const credentialsSavedInDb =
    settings?.quo_api_key && settings?.quo_phone_number_id;

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

  // Warn if User ID is filled (most users should leave blank)
  const hasUserId = userId?.trim();

  const lookupPhoneNumbers = async () => {
    setLookupLoading(true);
    setLookupError(null);
    setPhoneNumbers([]);
    try {
      const key = apiKey;
      if (!key) {
        setLookupError(
          "Please save your API key first before looking up phone numbers.",
        );
        return;
      }
      const res = await fetch(
        `/api/sms/quo-phone-numbers?apiKey=${encodeURIComponent(key)}`,
      );
      const data = await res.json();
      if (!res.ok) {
        setLookupError(
          data?.error || "Failed to fetch phone numbers from Quo.",
        );
      } else if (!data.phoneNumbers?.length) {
        setLookupError(
          "No phone numbers found in your Quo account. Make sure your API key has access to phone numbers.",
        );
      } else {
        setPhoneNumbers(data.phoneNumbers);
      }
    } catch (err) {
      setLookupError(err.message);
    } finally {
      setLookupLoading(false);
    }
  };

  const lookupPhoneNumbersNonRes = async () => {
    setLookupLoadingNonRes(true);
    setLookupErrorNonRes(null);
    setPhoneNumbersNonRes([]);
    try {
      const key = apiKey;
      if (!key) {
        setLookupErrorNonRes(
          "Please save your API key first before looking up phone numbers.",
        );
        return;
      }
      const res = await fetch(
        `/api/sms/quo-phone-numbers?apiKey=${encodeURIComponent(key)}`,
      );
      const data = await res.json();
      if (!res.ok) {
        setLookupErrorNonRes(
          data?.error || "Failed to fetch phone numbers from Quo.",
        );
      } else if (!data.phoneNumbers?.length) {
        setLookupErrorNonRes(
          "No phone numbers found in your Quo account. Make sure your API key has access to phone numbers.",
        );
      } else {
        setPhoneNumbersNonRes(data.phoneNumbers);
      }
    } catch (err) {
      setLookupErrorNonRes(err.message);
    } finally {
      setLookupLoadingNonRes(false);
    }
  };

  return (
    <>
      <section className="bg-white p-6 rounded-xl border border-gray-200 space-y-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-gray-900">
            <h2 className="font-semibold text-lg">Quo API Credentials</h2>
          </div>
          <a
            href="https://my.quo.com/settings/api"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
          >
            Quo Settings <ExternalLink size={12} />
          </a>
        </div>
        <p className="text-xs text-gray-500 -mt-2">
          Generate an API key in <strong>Quo → Settings → API</strong>. The
          Phone Number ID (starts with "PN") is found under{" "}
          <strong>Settings → Phone Numbers</strong>.
        </p>

        {/* API Key */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            API Key
          </label>
          <div className="relative">
            <input
              type={showQuoKey ? "text" : "password"}
              className="w-full px-3 py-2 pr-10 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
              value={apiKey}
              onChange={(e) =>
                updateField("quo_api_key", e.target.value, setApiKey)
              }
              onBlur={() => {
                if (dirty.quo_api_key) saveField("quo_api_key", apiKey);
              }}
              placeholder="your-quo-api-key"
            />
            <button
              type="button"
              onClick={() => setShowQuoKey((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showQuoKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {dirty.quo_api_key && (
            <p className="text-xs text-amber-600 font-medium">
              ⚠ Unsaved — click Save below or click outside this field
            </p>
          )}
        </div>

        {/* Phone Number ID */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Reservation Number ID
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 font-mono"
              value={phoneNumberId}
              onChange={(e) =>
                updateField(
                  "quo_phone_number_id",
                  e.target.value,
                  setPhoneNumberId,
                )
              }
              onBlur={() => {
                if (dirty.quo_phone_number_id)
                  saveField("quo_phone_number_id", phoneNumberId);
              }}
              placeholder="PNxxxxxxxxxx"
            />
            <button
              type="button"
              onClick={lookupPhoneNumbers}
              disabled={lookupLoading}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 disabled:opacity-50 whitespace-nowrap"
            >
              {lookupLoading ? (
                <Loader size={14} className="animate-spin" />
              ) : (
                <Search size={14} />
              )}
              {lookupLoading ? "Looking up…" : "Lookup"}
            </button>
          </div>
          {dirty.quo_phone_number_id && (
            <p className="text-xs text-amber-600 font-medium">
              ⚠ Unsaved — click Save below or click outside this field
            </p>
          )}

          {/* Lookup error */}
          {lookupError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-800">
              <strong>Error:</strong> {lookupError}
            </div>
          )}

          {/* Phone number picker */}
          {phoneNumbers.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-2">
              <p className="text-xs font-semibold text-green-800">
                ✅ Found {phoneNumbers.length} phone number
                {phoneNumbers.length > 1 ? "s" : ""} — click one to use it:
              </p>
              <div className="space-y-1">
                {phoneNumbers.map((pn) => (
                  <button
                    key={pn.id}
                    type="button"
                    onClick={() => {
                      // Save the PN ID (e.g. "PN6152650147") — NOT the E.164 number.
                      // Quo's API requires the PN ID format in the "from" field;
                      // sending E.164 causes a 404 "lookup by number" error.
                      const valueToSave =
                        pn.id && pn.id.startsWith("PN") ? pn.id : pn.number;
                      setPhoneNumberId(valueToSave);
                      handleUpdate("quo_phone_number_id", valueToSave);
                      setDirty((prev) => {
                        const next = { ...prev };
                        delete next.quo_phone_number_id;
                        return next;
                      });
                      toast.success(
                        `Phone number set to ${valueToSave} (${pn.number})`,
                      );
                      setPhoneNumbers([]);
                    }}
                    className="w-full text-left px-3 py-2 bg-white border border-green-200 rounded-lg text-xs font-mono hover:bg-green-100 transition-colors"
                  >
                    <span className="font-semibold text-gray-900">
                      {pn.number}
                    </span>
                    {pn.id && pn.id !== pn.number && (
                      <span className="text-blue-600 ml-2">ID: {pn.id}</span>
                    )}
                    {pn.name && pn.name !== pn.number && pn.name !== pn.id && (
                      <span className="text-gray-500 ml-2">({pn.name})</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-gray-400">
            Your main inbound/reservation number. Found in Quo → Settings →
            Phone Numbers → your number details. Use the Lookup button to
            auto-detect.
          </p>
        </div>

        {/* Non Reservation Number ID */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Non Reservation Number ID{" "}
            <span className="normal-case font-normal text-gray-400">
              (used for all outbound SMS)
            </span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              className="flex-1 px-3 py-2 bg-white border border-orange-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-400 font-mono"
              value={nonReservationPhoneNumberId}
              onChange={(e) =>
                updateField(
                  "quo_non_reservation_phone_number_id",
                  e.target.value,
                  setNonReservationPhoneNumberId,
                )
              }
              onBlur={() => {
                if (dirty.quo_non_reservation_phone_number_id)
                  saveField(
                    "quo_non_reservation_phone_number_id",
                    nonReservationPhoneNumberId,
                  );
              }}
              placeholder="PNxxxxxxxxxx"
            />
            <button
              type="button"
              onClick={lookupPhoneNumbersNonRes}
              disabled={lookupLoadingNonRes}
              className="flex items-center gap-1.5 px-3 py-2 bg-orange-50 border border-orange-200 text-orange-700 rounded-lg text-sm font-medium hover:bg-orange-100 disabled:opacity-50 whitespace-nowrap"
            >
              {lookupLoadingNonRes ? (
                <Loader size={14} className="animate-spin" />
              ) : (
                <Search size={14} />
              )}
              {lookupLoadingNonRes ? "Looking up…" : "Lookup"}
            </button>
          </div>
          {dirty.quo_non_reservation_phone_number_id && (
            <p className="text-xs text-amber-600 font-medium">
              ⚠ Unsaved — click Save below or click outside this field
            </p>
          )}
          {lookupErrorNonRes && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-800">
              <strong>Error:</strong> {lookupErrorNonRes}
            </div>
          )}
          {phoneNumbersNonRes.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 space-y-2">
              <p className="text-xs font-semibold text-orange-800">
                ✅ Found {phoneNumbersNonRes.length} phone number
                {phoneNumbersNonRes.length > 1 ? "s" : ""} — click one to use
                it:
              </p>
              <div className="space-y-1">
                {phoneNumbersNonRes.map((pn) => (
                  <button
                    key={pn.id}
                    type="button"
                    onClick={() => {
                      const valueToSave =
                        pn.id && pn.id.startsWith("PN") ? pn.id : pn.number;
                      setNonReservationPhoneNumberId(valueToSave);
                      handleUpdate(
                        "quo_non_reservation_phone_number_id",
                        valueToSave,
                      );
                      setDirty((prev) => {
                        const next = { ...prev };
                        delete next.quo_non_reservation_phone_number_id;
                        return next;
                      });
                      toast.success(
                        `Non Reservation number set to ${valueToSave} (${pn.number})`,
                      );
                      setPhoneNumbersNonRes([]);
                    }}
                    className="w-full text-left px-3 py-2 bg-white border border-orange-200 rounded-lg text-xs font-mono hover:bg-orange-100 transition-colors"
                  >
                    <span className="font-semibold text-gray-900">
                      {pn.number}
                    </span>
                    {pn.id && pn.id !== pn.number && (
                      <span className="text-blue-600 ml-2">ID: {pn.id}</span>
                    )}
                    {pn.name && pn.name !== pn.number && pn.name !== pn.id && (
                      <span className="text-gray-500 ml-2">({pn.name})</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-xs text-orange-800">
            📤{" "}
            <strong>
              All outbound SMS messages are sent from this number.
            </strong>{" "}
            If not set, the Reservation Number is used as fallback.
          </div>
        </div>

        {/* User ID (optional) */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            User ID (optional)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
              value={userId}
              onChange={(e) =>
                updateField("quo_user_id", e.target.value, setUserId)
              }
              onBlur={() => {
                if (dirty.quo_user_id) saveField("quo_user_id", userId);
              }}
              placeholder="your-quo-user-id"
            />
            <button
              type="button"
              onClick={lookupPhoneNumbers}
              disabled={lookupLoading}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 disabled:opacity-50 whitespace-nowrap"
            >
              {lookupLoading ? (
                <Loader size={14} className="animate-spin" />
              ) : (
                <Search size={14} />
              )}
              {lookupLoading ? "Looking up…" : "Lookup"}
            </button>
          </div>
          {dirty.quo_user_id && (
            <p className="text-xs text-amber-600 font-medium">
              ⚠ Unsaved — click Save below or click outside this field
            </p>
          )}
        </div>

        {/* Save All Button */}
        <div className="pt-3 border-t border-gray-200">
          {hasDirtyFields ? (
            <button
              type="button"
              onClick={saveAllCredentials}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Save size={16} />
              Save Quo Credentials
            </button>
          ) : credentialsSavedInDb ? (
            <div className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm font-medium">
              <CheckCircle2 size={16} />
              All credentials saved
            </div>
          ) : apiKey || phoneNumberId ? (
            <button
              type="button"
              onClick={saveAllCredentials}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600 transition-colors shadow-sm"
            >
              <AlertTriangle size={16} />
              Credentials NOT saved — Click to Save Now
            </button>
          ) : (
            <div className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm font-medium">
              <AlertTriangle size={16} />
              No credentials entered — SMS will not work
            </div>
          )}
        </div>
      </section>

      {/* Inbound SMS / Webhooks */}
      <section className="bg-white p-6 rounded-xl border border-gray-200 space-y-4">
        <div className="flex items-center gap-2 text-gray-900 mb-2">
          <h2 className="font-semibold text-lg">Inbound SMS (Webhooks)</h2>
        </div>
        <p className="text-xs text-gray-500 -mt-2">
          Configure this in <strong>Quo → Settings → Webhooks</strong>. Create a
          webhook for the{" "}
          <code className="bg-gray-100 px-1 rounded">message.received</code>{" "}
          event and paste your webhook URL below.
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
            Paste this URL into Quo's webhook configuration. Inbound passenger
            replies will be logged to their trip notes.
          </p>
        </div>

        {/* Webhook Signing Secret */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Webhook Signing Secret
          </label>
          <div className="relative">
            <input
              type={showWebhookSecret ? "text" : "password"}
              className="w-full px-3 py-2 pr-10 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 font-mono"
              value={webhookSecret}
              onChange={(e) =>
                updateField(
                  "quo_webhook_secret",
                  e.target.value,
                  setWebhookSecret,
                )
              }
              onBlur={() => {
                if (dirty.quo_webhook_secret)
                  saveField("quo_webhook_secret", webhookSecret);
              }}
              placeholder="Base64 signing secret from Quo webhook details"
            />
            <button
              type="button"
              onClick={() => setShowWebhookSecret((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showWebhookSecret ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <p className="text-xs text-gray-400">
            In Quo webhook details → click ⋯ → "Reveal signing secret". Paste
            the base64-encoded key here.
          </p>
          {dirty.quo_webhook_secret && (
            <button
              type="button"
              onClick={() => saveField("quo_webhook_secret", webhookSecret)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
            >
              <Save size={16} />
              Save Webhook Secret
            </button>
          )}
        </div>
      </section>

      {/* Confirmation message template */}
      <section className="bg-white p-6 rounded-xl border border-gray-200 space-y-4">
        <div className="flex items-center gap-2 text-gray-900 mb-2">
          <h2 className="font-semibold text-lg">
            Confirmation Message Template
          </h2>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Message Template
          </label>
          <textarea
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 min-h-[100px]"
            value={confirmationTemplate}
            onChange={(e) =>
              updateField(
                "sms_confirmation_message",
                e.target.value,
                setConfirmationTemplate,
              )
            }
            onBlur={() => {
              if (dirty.sms_confirmation_message)
                saveField("sms_confirmation_message", confirmationTemplate);
            }}
          />
          <p className="text-xs text-gray-400">
            Available variables:{" "}
            <code className="bg-gray-100 px-1 rounded">{"{name}"}</code>{" "}
            <code className="bg-gray-100 px-1 rounded">{"{date}"}</code>{" "}
            <code className="bg-gray-100 px-1 rounded">{"{business}"}</code>{" "}
            <code className="bg-gray-100 px-1 rounded">{"{driver}"}</code>
          </p>
          {dirty.sms_confirmation_message && (
            <button
              type="button"
              onClick={() =>
                saveField("sms_confirmation_message", confirmationTemplate)
              }
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
            >
              <Save size={16} />
              Save Template
            </button>
          )}
        </div>
      </section>
    </>
  );
}
