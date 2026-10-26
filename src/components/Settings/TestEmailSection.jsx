import { Mail, Send } from "lucide-react";

export function TestEmailSection({
  settings,
  testEmail,
  setTestEmail,
  sendingTestEmail,
  handleSendTestEmail,
}) {
  const fromName =
    settings?.from_name || settings?.business_name || "Catch A Ride";
  const fromAddress = settings?.from_email
    ? `${fromName} <${settings.from_email}>`
    : "bookings@catcharide.us";

  return (
    <section className="bg-white p-6 rounded-xl border border-gray-200 space-y-4">
      <div className="flex items-center gap-2 text-gray-900 mb-2">
        <Mail size={18} className="text-blue-600" />
        <h2 className="font-semibold text-lg">Send Test Email</h2>
      </div>
      <p className="text-xs text-gray-500">
        Verify your email notifications are working. Sends from{" "}
        <code className="bg-gray-100 px-1 rounded">{fromAddress}</code>.{" "}
        {!settings?.from_email && (
          <span className="text-amber-500">
            Set a From Email above to use your own domain.
          </span>
        )}
      </p>
      <div className="flex items-center gap-3">
        <input
          type="email"
          className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
          placeholder={settings?.owner_email || "your@email.com"}
          value={testEmail}
          onChange={(e) => setTestEmail(e.target.value)}
        />
        <button
          onClick={() => handleSendTestEmail(settings?.owner_email)}
          disabled={sendingTestEmail}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          <Send size={14} />
          {sendingTestEmail ? "Sending…" : "Send Test"}
        </button>
      </div>
    </section>
  );
}
