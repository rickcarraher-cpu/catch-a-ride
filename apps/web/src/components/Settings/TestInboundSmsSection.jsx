import { useState } from "react";
import { MessageSquare } from "lucide-react";

export function TestInboundSmsSection() {
  const [from, setFrom] = useState("");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleTest = async () => {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/sms/test-inbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, message }),
      });

      const data = await response.json();
      setResult({ status: response.ok ? "success" : "error", data });
    } catch (error) {
      setResult({ status: "error", data: { error: error.message } });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
      <div className="flex items-center gap-2">
        <MessageSquare size={16} className="text-blue-600" />
        <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">
          Test Inbound SMS Forwarding
        </h3>
      </div>

      <p className="text-xs text-gray-500">
        Simulate an incoming text message from a passenger or driver to test the
        forwarding system.
      </p>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">
            From Phone Number
          </label>
          <input
            type="text"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            placeholder="+16155551234 or 6155551234"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-400 mt-1">
            Enter a phone number that matches a participant in an existing trip
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">
            Message
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Test message from passenger"
            rows={3}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <button
          onClick={handleTest}
          disabled={loading || !from || !message}
          className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Sending..." : "Send Test Inbound SMS"}
        </button>
      </div>

      {result && (
        <div
          className={`p-3 rounded-lg text-sm ${
            result.status === "success"
              ? "bg-green-50 border border-green-200 text-green-800"
              : "bg-red-50 border border-red-200 text-red-800"
          }`}
        >
          <div className="font-semibold mb-2">
            {result.status === "success" ? "✅ Success" : "❌ Error"}
          </div>

          {result.status === "success" && result.data.forwarded_to && (
            <div className="space-y-1">
              <div className="text-xs font-medium">Message forwarded to:</div>
              <ul className="text-xs space-y-0.5 ml-3">
                {result.data.forwarded_to.map((recipient, idx) => (
                  <li key={idx}>
                    {recipient.status === "sent" ? "✓" : "✗"}{" "}
                    {recipient.recipient} ({recipient.phone})
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.status === "error" && (
            <div className="text-xs">
              {result.data.error || "Unknown error occurred"}
            </div>
          )}
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="text-xs font-semibold text-blue-900 mb-1.5">
          💡 How to use:
        </div>
        <ol className="text-xs text-blue-800 space-y-0.5 list-decimal list-inside">
          <li>Create a trip with a passenger and driver</li>
          <li>Enter the passenger's phone number above</li>
          <li>Enter a test message</li>
          <li>Click "Send Test Inbound SMS"</li>
          <li>Check Driver Messages to see the forwarded message</li>
        </ol>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
        <div className="text-xs font-semibold text-yellow-900 mb-1">
          ⚠️ Note:
        </div>
        <p className="text-xs text-yellow-800">
          This simulates what happens when ClickSend receives an inbound SMS. If
          this works but real SMS messages don't forward, the issue is with
          ClickSend's webhook configuration.
        </p>
      </div>
    </div>
  );
}
