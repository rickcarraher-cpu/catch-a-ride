import { CreditCard, CheckCircle2, AlertCircle } from "lucide-react";
import { useState } from "react";

export function PaymentMethodsSection({ settings, handleUpdate }) {
  const [showSquareConfig, setShowSquareConfig] = useState(false);

  const paymentMethods = [
    { key: "cash", label: "Cash" },
    { key: "square_invoice", label: "Square Invoice" },
    { key: "venmo", label: "Venmo" },
    { key: "zelle", label: "Zelle" },
    { key: "square", label: "Square" },
    { key: "stripe", label: "Stripe" },
  ];

  const squareConfigured =
    settings?.square_access_token && settings?.square_location_id;

  return (
    <section className="bg-white p-6 rounded-xl border border-gray-200 space-y-4">
      <div className="flex items-center gap-2 text-gray-900 mb-2">
        <CreditCard size={18} className="text-blue-600" />
        <h2 className="font-semibold text-lg">Payment Methods & Settings</h2>
      </div>

      {/* Prepayment Toggle */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-100">
        <div>
          <p className="text-sm font-semibold text-gray-900">
            Require Prepayment
          </p>
          <p className="text-xs text-gray-500">
            Ask passengers to pay before confirming their booking.
          </p>
        </div>
        <button
          onClick={() =>
            handleUpdate(
              "prepay_enabled",
              settings?.prepay_enabled === "true" ? "false" : "true",
            )
          }
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings?.prepay_enabled === "true" ? "bg-blue-600" : "bg-gray-200"}`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings?.prepay_enabled === "true" ? "translate-x-6" : "translate-x-1"}`}
          />
        </button>
      </div>

      {/* Tipping Toggle */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-100">
        <div>
          <p className="text-sm font-semibold text-gray-900">Enable Tipping</p>
          <p className="text-xs text-gray-500">
            Allow passengers to add tips during checkout.
          </p>
        </div>
        <button
          onClick={() =>
            handleUpdate(
              "tipping_enabled",
              settings?.tipping_enabled === "true" ? "false" : "true",
            )
          }
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings?.tipping_enabled === "true" ? "bg-blue-600" : "bg-gray-200"}`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings?.tipping_enabled === "true" ? "translate-x-6" : "translate-x-1"}`}
          />
        </button>
      </div>

      {/* Credit Card Fee Percentage */}
      <div className="pb-4 border-b border-gray-100">
        <div className="mb-2">
          <p className="text-sm font-semibold text-gray-900">
            Credit Card Processing Fee
          </p>
          <p className="text-xs text-gray-500">
            Percentage fee added to Credit Card and Square payments
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            step="0.1"
            min="0"
            max="100"
            value={settings?.credit_card_fee_percent || "4"}
            onChange={(e) =>
              handleUpdate("credit_card_fee_percent", e.target.value)
            }
            className="w-24 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-600">%</span>
          <span className="text-xs text-gray-400">
            (e.g., 4% = $4 fee on $100)
          </span>
        </div>
      </div>

      {/* Payment Methods */}
      <div className="space-y-3 pb-4 border-b border-gray-100">
        <p className="text-sm font-semibold text-gray-900">
          Accepted Payment Methods
        </p>
        <div className="grid grid-cols-2 gap-3">
          {paymentMethods.map((method) => {
            const isEnabled =
              settings?.[`payment_${method.key}_enabled`] === "true";
            return (
              <button
                key={method.key}
                onClick={() =>
                  handleUpdate(
                    `payment_${method.key}_enabled`,
                    isEnabled ? "false" : "true",
                  )
                }
                className={`px-4 py-3 rounded-lg border text-sm font-semibold transition-all ${
                  isEnabled
                    ? "bg-blue-50 border-blue-200 text-blue-700"
                    : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                }`}
              >
                {method.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Venmo Details */}
      {settings?.payment_venmo_enabled === "true" && (
        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-900">
            Venmo Handle
          </label>
          <input
            type="text"
            value={settings?.venmo_handle || ""}
            onChange={(e) => handleUpdate("venmo_handle", e.target.value)}
            placeholder="@your-venmo-handle"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      {/* Zelle Details */}
      {settings?.payment_zelle_enabled === "true" && (
        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-900">
            Zelle Email or Phone
          </label>
          <input
            type="text"
            value={settings?.zelle_contact || ""}
            onChange={(e) => handleUpdate("zelle_contact", e.target.value)}
            placeholder="email@example.com or (555) 555-5555"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      {/* Square Configuration */}
      {settings?.payment_square_enabled === "true" && (
        <div className="space-y-3 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-gray-900">
                Square Configuration
              </p>
              {squareConfigured ? (
                <div className="flex items-center gap-1 text-green-600">
                  <CheckCircle2 size={14} />
                  <span className="text-xs font-medium">Connected</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-amber-600">
                  <AlertCircle size={14} />
                  <span className="text-xs font-medium">Not configured</span>
                </div>
              )}
            </div>
            <button
              onClick={() => setShowSquareConfig(!showSquareConfig)}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              {showSquareConfig ? "Hide" : "Configure"}
            </button>
          </div>

          {showSquareConfig && (
            <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-700">
                  Environment
                </label>
                <select
                  value={settings?.square_environment || "sandbox"}
                  onChange={(e) =>
                    handleUpdate("square_environment", e.target.value)
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="sandbox">Sandbox (Testing)</option>
                  <option value="production">Production (Live)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-700">
                  Access Token
                </label>
                <input
                  type="password"
                  value={settings?.square_access_token || ""}
                  onChange={(e) =>
                    handleUpdate("square_access_token", e.target.value)
                  }
                  placeholder="EAAAxxxxxxxxxxxxxxx"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-700">
                  Application ID
                </label>
                <input
                  type="text"
                  value={settings?.square_application_id || ""}
                  onChange={(e) =>
                    handleUpdate("square_application_id", e.target.value)
                  }
                  placeholder="sq0idp-xxxxxxxxxxxxxxxx"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-700">
                  Location ID
                </label>
                <input
                  type="text"
                  value={settings?.square_location_id || ""}
                  onChange={(e) =>
                    handleUpdate("square_location_id", e.target.value)
                  }
                  placeholder="Lxxxxxxxxxxxxxxxx"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-700">
                  Webhook Signature Key (Optional)
                </label>
                <input
                  type="password"
                  value={settings?.square_webhook_signature || ""}
                  onChange={(e) =>
                    handleUpdate("square_webhook_signature", e.target.value)
                  }
                  placeholder="For verifying webhook authenticity"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                <p className="text-xs text-blue-700 font-semibold">
                  ⚡ Webhook URL (Required for auto-payment detection)
                </p>
                <div className="flex items-center gap-2">
                  <code className="text-xs text-blue-800 bg-white px-2 py-1 rounded border border-blue-200 break-all flex-1">
                    https://book.catcharide.us/api/payments/square/webhook
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(
                        "https://book.catcharide.us/api/payments/square/webhook",
                      );
                      alert("Webhook URL copied!");
                    }}
                    className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Copy
                  </button>
                </div>
                <div className="text-xs text-blue-600 space-y-1">
                  <p className="font-semibold">Setup in Square Dashboard:</p>
                  <ol className="list-decimal list-inside space-y-0.5 text-blue-500">
                    <li>
                      <a
                        href="https://developer.squareup.com/apps"
                        target="_blank"
                        rel="noopener"
                        className="underline"
                      >
                        Square Developer Dashboard
                      </a>
                    </li>
                    <li>Select your app → Webhooks → Add Subscription</li>
                    <li>Paste the webhook URL above</li>
                    <li>
                      Subscribe to:
                      <strong>payment.created</strong>,
                      <strong>payment.updated</strong>,
                      <strong>invoice.payment_made</strong>
                    </li>
                    <li>
                      Copy the Signature Key and paste it above (optional but
                      recommended)
                    </li>
                  </ol>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
