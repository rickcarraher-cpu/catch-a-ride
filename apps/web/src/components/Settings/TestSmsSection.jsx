import { useState } from "react";
import {
  Send,
  MessageSquare,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader,
} from "lucide-react";

export function TestSmsSection({
  settings,
  testPhone,
  setTestPhone,
  sendingTest,
  handleSendTestSms,
  handleUpdate,
}) {
  const [customPhone, setCustomPhone] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [sendingCustom, setSendingCustom] = useState(false);
  const [customResult, setCustomResult] = useState(null);

  // Diagnostic test state
  const [diagnosticPhone, setDiagnosticPhone] = useState("");
  const [diagnosticLoading, setDiagnosticLoading] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState(null);

  const handleSendCustomSms = async () => {
    if (!customPhone || !customMessage) return;
    setSendingCustom(true);
    setCustomResult(null);
    try {
      const res = await fetch("/api/sms/send-custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: customPhone, message: customMessage }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed (${res.status})`);
      }
      setCustomResult({ success: true, text: "Message sent!" });
      setCustomMessage("");
    } catch (err) {
      console.error("[Custom SMS]", err);
      setCustomResult({ success: false, text: err.message });
    } finally {
      setSendingCustom(false);
    }
  };

  const handleDiagnosticTest = async () => {
    if (!diagnosticPhone.trim()) {
      alert("Please enter a phone number");
      return;
    }

    setDiagnosticLoading(true);
    setDiagnosticResult(null);

    try {
      const res = await fetch("/api/sms/test-quo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: diagnosticPhone }),
      });

      const data = await res.json();
      setDiagnosticResult(data);
    } catch (err) {
      setDiagnosticResult({ error: err.message, overallSuccess: false });
    } finally {
      setDiagnosticLoading(false);
    }
  };

  return (
    <>
      {/* Diagnostic Test Section */}
      <section className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-xl border-2 border-blue-200 space-y-4">
        <div className="flex items-center gap-2 text-gray-900 mb-2">
          <AlertTriangle size={18} className="text-blue-600" />
          <h2 className="font-semibold text-lg">🔍 Quo Diagnostic Test</h2>
        </div>
        <p className="text-sm text-gray-700">
          Run a comprehensive test that tries sending SMS{" "}
          <strong>both with and without User ID</strong> to diagnose 403
          permission errors.
        </p>

        <div className="flex gap-2">
          <input
            type="tel"
            value={diagnosticPhone}
            onChange={(e) => setDiagnosticPhone(e.target.value)}
            placeholder="Enter test phone number"
            className="flex-1 px-3 py-2 bg-white border border-blue-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
          />
          <button
            onClick={handleDiagnosticTest}
            disabled={diagnosticLoading || !diagnosticPhone.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {diagnosticLoading ? (
              <>
                <Loader size={16} className="animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <Send size={16} />
                Run Diagnostic
              </>
            )}
          </button>
        </div>

        {diagnosticResult && (
          <div className="space-y-4 mt-4">
            {/* Overall recommendation banner */}
            {diagnosticResult.recommendation && (
              <div
                className={`rounded-lg p-4 border-2 ${
                  diagnosticResult.recommendation.includes("Clear the User ID")
                    ? "bg-amber-50 border-amber-400"
                    : diagnosticResult.recommendation.includes(
                          "Neither approach worked",
                        )
                      ? "bg-red-50 border-red-400"
                      : "bg-green-50 border-green-400"
                }`}
              >
                <div className="flex items-start gap-3">
                  {diagnosticResult.recommendation.includes(
                    "Clear the User ID",
                  ) ? (
                    <AlertTriangle
                      size={20}
                      className="text-amber-600 flex-shrink-0 mt-0.5"
                    />
                  ) : diagnosticResult.recommendation.includes(
                      "Neither approach worked",
                    ) ? (
                    <XCircle
                      size={20}
                      className="text-red-600 flex-shrink-0 mt-0.5"
                    />
                  ) : (
                    <CheckCircle
                      size={20}
                      className="text-green-600 flex-shrink-0 mt-0.5"
                    />
                  )}
                  <div className="flex-1">
                    <p
                      className={`text-sm font-semibold mb-1 ${
                        diagnosticResult.recommendation.includes(
                          "Clear the User ID",
                        )
                          ? "text-amber-900"
                          : diagnosticResult.recommendation.includes(
                                "Neither approach worked",
                              )
                            ? "text-red-900"
                            : "text-green-900"
                      }`}
                    >
                      Diagnostic Result
                    </p>
                    <p
                      className={`text-sm ${
                        diagnosticResult.recommendation.includes(
                          "Clear the User ID",
                        )
                          ? "text-amber-800"
                          : diagnosticResult.recommendation.includes(
                                "Neither approach worked",
                              )
                            ? "text-red-800"
                            : "text-green-800"
                      }`}
                    >
                      {diagnosticResult.recommendation}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Configuration used */}
            {(diagnosticResult.phoneNumberId ||
              diagnosticResult.resolvedFrom ||
              diagnosticResult.userId) && (
              <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-1">
                <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                  Configuration Tested
                </p>
                {diagnosticResult.phoneNumberId && (
                  <p className="text-xs text-gray-600">
                    <span className="font-mono font-semibold">
                      Phone Number ID:
                    </span>{" "}
                    {diagnosticResult.phoneNumberId}
                  </p>
                )}
                {diagnosticResult.resolvedFrom && (
                  <p className="text-xs text-gray-600">
                    <span className="font-mono font-semibold">
                      Resolved From:
                    </span>{" "}
                    {diagnosticResult.resolvedFrom}
                  </p>
                )}
                {diagnosticResult.to && (
                  <p className="text-xs text-gray-600">
                    <span className="font-mono font-semibold">To:</span>{" "}
                    {diagnosticResult.to}
                  </p>
                )}
                {diagnosticResult.userId && (
                  <p className="text-xs text-gray-600">
                    <span className="font-mono font-semibold">User ID:</span>{" "}
                    {diagnosticResult.userId}
                  </p>
                )}
              </div>
            )}

            {/* Test results */}
            {diagnosticResult.tests && diagnosticResult.tests.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Test Results
                </p>
                {diagnosticResult.tests.map((test, idx) => (
                  <div
                    key={idx}
                    className={`border-2 rounded-lg p-4 ${
                      test.success === true
                        ? "bg-green-50 border-green-300"
                        : test.success === false
                          ? "bg-red-50 border-red-300"
                          : "bg-gray-50 border-gray-300"
                    }`}
                  >
                    <div className="flex items-start gap-2 mb-2">
                      {test.success === true ? (
                        <CheckCircle
                          size={18}
                          className="text-green-600 flex-shrink-0 mt-0.5"
                        />
                      ) : test.success === false ? (
                        <XCircle
                          size={18}
                          className="text-red-600 flex-shrink-0 mt-0.5"
                        />
                      ) : (
                        <AlertTriangle
                          size={18}
                          className="text-gray-600 flex-shrink-0 mt-0.5"
                        />
                      )}
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900">
                          {test.test}
                          {test.status && (
                            <span
                              className={`ml-2 text-xs font-mono ${
                                test.success ? "text-green-700" : "text-red-700"
                              }`}
                            >
                              [{test.status}]
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          {test.message}
                        </p>
                        {test.userId &&
                          test.userId !==
                            "(skipped - no valid User ID set)" && (
                            <p className="text-xs text-gray-500 mt-1 font-mono">
                              User ID: {test.userId}
                            </p>
                          )}
                      </div>
                    </div>

                    {/* Expandable request/response details */}
                    {test.requestSent && (
                      <details className="mt-3">
                        <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-900 hover:underline">
                          📋 View request/response details
                        </summary>
                        <div className="mt-2 space-y-2">
                          <div className="bg-white border border-gray-200 rounded p-2">
                            <p className="text-xs font-semibold text-gray-700 mb-1">
                              Request Body:
                            </p>
                            <pre className="text-xs text-gray-600 overflow-x-auto">
                              {JSON.stringify(test.requestSent, null, 2)}
                            </pre>
                          </div>
                          {test.response && (
                            <div className="bg-white border border-gray-200 rounded p-2">
                              <p className="text-xs font-semibold text-gray-700 mb-1">
                                Response:
                              </p>
                              <pre className="text-xs text-gray-600 overflow-x-auto">
                                {JSON.stringify(test.response, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Error display */}
            {diagnosticResult.error && !diagnosticResult.tests && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <XCircle
                    size={18}
                    className="text-red-600 flex-shrink-0 mt-0.5"
                  />
                  <div>
                    <p className="text-sm font-semibold text-red-900 mb-1">
                      Error
                    </p>
                    <p className="text-sm text-red-800">
                      {diagnosticResult.error}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Rest of existing sections... */}
      <section className="bg-white p-6 rounded-xl border border-gray-200 space-y-4">
        <div className="flex items-center gap-2 text-gray-900 mb-2">
          <Send size={18} className="text-blue-600" />
          <h2 className="font-semibold text-lg">Send Test SMS</h2>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="tel"
            className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
            placeholder={settings?.sms_test_phone || "+1 555 000 0000"}
            value={testPhone}
            onChange={(e) => setTestPhone(e.target.value)}
            onBlur={(e) => {
              if (e.target.value)
                handleUpdate("sms_test_phone", e.target.value);
            }}
          />
          <button
            onClick={handleSendTestSms}
            disabled={sendingTest}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            <Send size={14} />
            {sendingTest ? "Sending…" : "Send Test"}
          </button>
        </div>
        <p className="text-xs text-gray-400">
          Sends a quick test message to verify your Quo credentials. Phone
          number auto-saves as your default test number.
        </p>
      </section>

      <section className="bg-white p-6 rounded-xl border border-gray-200 space-y-4">
        <div className="flex items-center gap-2 text-gray-900 mb-2">
          <MessageSquare size={18} className="text-green-600" />
          <h2 className="font-semibold text-lg">Send Custom SMS</h2>
        </div>
        <p className="text-sm text-gray-500">
          Send a text message to any phone number. An opt-out footer will be
          automatically added.
        </p>
        <div className="space-y-3">
          <input
            type="tel"
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-600"
            placeholder="Phone number (e.g. 615-555-1234)"
            value={customPhone}
            onChange={(e) => setCustomPhone(e.target.value)}
          />
          <div className="relative">
            <textarea
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-600 resize-none"
              placeholder="Type your message here..."
              rows={4}
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              maxLength={1600}
            />
            <span className="absolute bottom-2 right-3 text-xs text-gray-300">
              {customMessage.length}/1600
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              {customResult && (
                <p
                  className={`text-sm font-medium ${customResult.success ? "text-green-600" : "text-red-600"}`}
                >
                  {customResult.text}
                </p>
              )}
            </div>
            <button
              onClick={handleSendCustomSms}
              disabled={sendingCustom || !customPhone || !customMessage}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            >
              <Send size={14} />
              {sendingCustom ? "Sending…" : "Send Message"}
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
