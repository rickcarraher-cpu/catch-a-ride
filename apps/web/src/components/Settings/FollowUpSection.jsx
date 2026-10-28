import React, { useState, useEffect, useRef } from "react";
import {
  Heart,
  TestTube,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";

export function FollowUpSection({ settings, handleUpdate }) {
  const [testEmail, setTestEmail] = useState("");
  const [testPhone, setTestPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Local state buffers so typing isn't interrupted by re-fetches
  const [localReviewLink, setLocalReviewLink] = useState("");
  const [localFollowupMessage, setLocalFollowupMessage] = useState("");

  // Only sync from server settings once on initial load
  const initialSyncDone = useRef(false);

  useEffect(() => {
    if (settings && !initialSyncDone.current) {
      initialSyncDone.current = true;
      setLocalReviewLink(
        settings.google_review_link ||
          "https://g.page/r/YOUR_REVIEW_LINK/review",
      );
      setLocalFollowupMessage(
        settings.followup_message ||
          "Thank you for choosing {business}! We hope you had a wonderful trip. We'd love to hear about your experience — please take a moment to leave us a review: {review_link}",
      );
    }
  }, [settings]);

  const followupEnabled = settings?.followup_enabled === "yes";

  // Fallbacks for preview (use local state)
  const reviewLinkForPreview =
    localReviewLink || "https://g.page/r/YOUR_REVIEW_LINK/review";
  const followupMessageForPreview =
    localFollowupMessage ||
    "Thank you for choosing {business}! We hope you had a wonderful trip. We'd love to hear about your experience — please take a moment to leave us a review: {review_link}";

  // Derive config status from settings
  const hasEmail = !!settings?.from_email;
  const smsProvider = settings?.sms_provider;
  const hasClickSend =
    smsProvider === "ClickSend" &&
    !!settings?.clicksend_username &&
    !!settings?.clicksend_api_key;
  const hasOpenPhone =
    smsProvider === "Quo" &&
    !!settings?.quo_api_key &&
    !!settings?.quo_phone_number_id;
  const hasSms = hasClickSend || hasOpenPhone;

  const handleSendTest = async () => {
    if (!testEmail && !testPhone) {
      setTestResult({
        success: false,
        error: "Please enter an email or phone number above.",
      });
      return;
    }

    setSending(true);
    setTestResult(null);

    try {
      const response = await fetch("/api/followup/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testEmail || null,
          phone: testPhone || null,
          message: localFollowupMessage,
          reviewLink: localReviewLink,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setTestResult({
          success: false,
          error: result.error || "Failed to send test follow-up",
          warnings: result.warnings || [],
        });
        return;
      }

      const parts = [];
      if (result.smsSent) parts.push("SMS sent ✓");
      if (result.emailSent) parts.push("Email sent ✓");

      setTestResult({
        success: true,
        message: parts.length > 0 ? parts.join(" · ") : "Test sent!",
        warnings: result.warnings || [],
        smsSent: result.smsSent,
        emailSent: result.emailSent,
      });
    } catch (error) {
      console.error("Test follow-up error:", error);
      setTestResult({ success: false, error: error.message, warnings: [] });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Enable/Disable Toggle ────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Heart size={18} className="text-pink-600" />
          <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">
            Thank You Follow-Up
          </h3>
        </div>
        <p className="text-xs text-gray-400">
          Send a thank-you message to passengers 24 hours after their trip with
          a Google review link.
        </p>

        <div className="flex items-center justify-between pt-2">
          <div>
            <p className="text-sm font-medium text-gray-700">
              Enable Follow-Up Messages
            </p>
            <p className="text-xs text-gray-400">
              Automatically send thank you messages 24 hours after trip
              completion
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              handleUpdate("followup_enabled", followupEnabled ? "no" : "yes")
            }
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              followupEnabled ? "bg-pink-500" : "bg-gray-300"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                followupEnabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </div>

      {/* ── Google Review Link ────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Google Review Link
          </label>
          <p className="text-xs text-gray-400 mb-3">
            Your Google Business review URL. Find it by searching your business
            on Google, clicking "Reviews", then copying the share link.
          </p>
          <input
            type="url"
            value={localReviewLink}
            onChange={(e) => setLocalReviewLink(e.target.value)}
            onBlur={() => handleUpdate("google_review_link", localReviewLink)}
            placeholder="https://g.page/r/YOUR_REVIEW_LINK/review"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
          />
          <p className="text-xs text-gray-400 mt-2">
            💡 To find your link: Google your business → Click "Write a review"
            → Copy the URL
          </p>
        </div>
      </div>

      {/* ── Thank You Message ──────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Thank You Message
          </label>
          <p className="text-xs text-gray-400 mb-3">
            Customize the message sent to passengers. Use placeholders:{" "}
            <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">
              {"{business}"}
            </code>
            ,{" "}
            <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">
              {"{name}"}
            </code>
            ,{" "}
            <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">
              {"{review_link}"}
            </code>
          </p>
          <textarea
            value={localFollowupMessage}
            onChange={(e) => setLocalFollowupMessage(e.target.value)}
            onBlur={() =>
              handleUpdate("followup_message", localFollowupMessage)
            }
            rows={6}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 font-mono"
            placeholder="Thank you for choosing {business}! We hope you had a wonderful trip..."
          />
          <p className="text-xs text-gray-400 mt-1 text-right">
            Click outside the box to save
          </p>
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs font-semibold text-blue-800 mb-2">
              Preview with placeholders:
            </p>
            <p className="text-xs text-gray-700 leading-relaxed">
              {followupMessageForPreview
                .replace(
                  /\{business\}/gi,
                  settings?.business_name || "Your Business",
                )
                .replace(/\{name\}/gi, "John")
                .replace(/\{review_link\}/gi, reviewLinkForPreview)}
            </p>
          </div>
        </div>
      </div>

      {/* ── Test Follow-Up ─────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-pink-50 to-purple-50 border border-pink-200 rounded-lg p-5 space-y-4">
        <div className="flex items-center gap-2">
          <TestTube size={16} className="text-pink-600" />
          <h4 className="text-sm font-semibold text-gray-800">
            Test Follow-Up
          </h4>
        </div>
        <p className="text-xs text-gray-500">
          Send a test follow-up message to yourself to see how it looks.
        </p>

        {/* Config status row */}
        <div className="flex flex-wrap gap-2">
          <span
            className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${hasEmail ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
          >
            {hasEmail ? <CheckCircle size={11} /> : <XCircle size={11} />}
            Email {hasEmail ? "ready" : "not configured"}
          </span>
          <span
            className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${hasSms ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}
          >
            {hasSms ? <CheckCircle size={11} /> : <AlertCircle size={11} />}
            SMS {hasSms ? `ready (${smsProvider})` : "not configured"}
          </span>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Test Email{" "}
              {hasEmail ? "(optional)" : "(requires From Email in Settings)"}
            </label>
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="your@email.com"
              disabled={!hasEmail}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 disabled:opacity-40 disabled:bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Test Phone{" "}
              {hasSms ? "(optional)" : "(requires SMS setup in Settings)"}
            </label>
            <input
              type="tel"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="+1 (555) 123-4567"
              disabled={!hasSms}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 disabled:opacity-40 disabled:bg-gray-50"
            />
          </div>
        </div>

        <button
          onClick={handleSendTest}
          disabled={sending || (!testEmail && !testPhone)}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-pink-600 text-white hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {sending ? "Sending..." : "Send Test Follow-Up"}
        </button>

        {testResult && (
          <div className="space-y-2">
            <div
              className={`text-sm rounded-lg p-3 ${
                testResult.success
                  ? "text-green-700 bg-green-50 border border-green-200"
                  : "text-red-700 bg-red-50 border border-red-200"
              }`}
            >
              {testResult.success ? testResult.message : testResult.error}
            </div>
            {testResult.warnings && testResult.warnings.length > 0 && (
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
                {testResult.warnings.map((w, i) => (
                  <p key={i} className="flex items-start gap-1">
                    <AlertCircle size={12} className="mt-0.5 shrink-0" />
                    {w}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Automation Setup Instructions ──────────────────────────────────── */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-5 space-y-3">
        <h4 className="text-sm font-semibold text-gray-800">
          🤖 Automation Setup
        </h4>
        <p className="text-xs text-gray-600 leading-relaxed">
          To automatically send follow-ups, set up a daily cron job that calls:
        </p>
        <div className="bg-white border border-gray-300 rounded-lg p-3">
          <code className="text-xs text-gray-700 break-all">
            GET {typeof window !== "undefined" ? window.location.origin : ""}
            /api/followup/send?secret=YOUR_SECRET
          </code>
        </div>
        <p className="text-xs text-gray-500">
          💡 Set{" "}
          <code className="bg-white px-1 py-0.5 rounded">FOLLOWUP_SECRET</code>{" "}
          as an environment variable and use a service like{" "}
          <a
            href="https://cron-job.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            cron-job.org
          </a>{" "}
          to schedule daily calls at 12:00 PM.
        </p>
      </div>
    </div>
  );
}
