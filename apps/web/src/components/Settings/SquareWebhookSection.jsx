import React, { useState } from "react";
import { Copy, Check, ExternalLink, Zap } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export function SquareWebhookSection() {
  const [copied, setCopied] = useState(false);

  // Get the webhook URL from the current domain
  const webhookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/payments/square/webhook`
      : "https://your-domain.com/api/payments/square/webhook";

  // Check if any webhook events have been received
  const { data: eventsData } = useQuery({
    queryKey: ["square-webhook-check"],
    queryFn: async () => {
      const res = await fetch("/api/reports/square-payments");
      if (!res.ok) return { payments: [] };
      return res.json();
    },
    staleTime: 30000,
  });

  const hasEvents = (eventsData?.payments || []).length > 0;

  const handleCopy = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <Zap size={18} className="text-blue-600" />
          <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">
            Square Webhook Configuration
          </h3>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          Configure Square to send payment notifications so the app can
          automatically mark trips as paid
        </p>
      </div>

      {/* Webhook URL Display */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">
            Your Webhook URL
          </p>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            {copied ? (
              <>
                <Check size={14} className="text-green-600" />
                Copied!
              </>
            ) : (
              <>
                <Copy size={14} />
                Copy URL
              </>
            )}
          </button>
        </div>
        <code className="block text-xs text-blue-600 bg-white border border-gray-200 rounded px-3 py-2 font-mono break-all">
          {webhookUrl}
        </code>
      </div>

      {/* Setup Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
        <p className="text-sm font-medium text-blue-900">
          📋 Setup Instructions
        </p>
        <ol className="text-xs text-blue-800 space-y-2 list-decimal list-inside">
          <li>
            Log into your{" "}
            <a
              href="https://developer.squareup.com/apps"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-medium hover:text-blue-600"
            >
              Square Developer Dashboard
              <ExternalLink size={10} className="inline ml-0.5 mb-0.5" />
            </a>
          </li>
          <li>Select your application (or create one if needed)</li>
          <li>
            In the left sidebar, click <strong>Webhooks</strong>
          </li>
          <li>
            Click <strong>Add Subscription</strong> (or{" "}
            <strong>Add Endpoint</strong>)
          </li>
          <li>
            Paste your webhook URL (copied above) into the <strong>URL</strong>{" "}
            field
          </li>
          <li>
            Subscribe to these events:
            <ul className="list-disc list-inside ml-4 mt-1 space-y-0.5">
              <li>
                <strong>payment.created</strong>
              </li>
              <li>
                <strong>payment.updated</strong>
              </li>
              <li>
                <strong>invoice.payment_made</strong>
              </li>
              <li>
                <strong>refund.created</strong> (optional)
              </li>
              <li>
                <strong>refund.updated</strong> (optional)
              </li>
            </ul>
          </li>
          <li>
            Click <strong>Save</strong>
          </li>
          <li>
            <strong>(Optional)</strong> Copy the <strong>Signature Key</strong>{" "}
            and save it in Settings → General → Payment Methods as "Square
            Webhook Signature" for extra security
          </li>
        </ol>
      </div>

      {/* What This Does */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
        <p className="text-sm font-medium text-green-900">
          ✅ What happens when connected
        </p>
        <ul className="text-xs text-green-800 space-y-1.5 list-disc list-inside">
          <li>
            When a customer pays via Square, the app is notified instantly
          </li>
          <li>
            The trip is automatically marked as <strong>Paid</strong>
          </li>
          <li>
            Payment, tip, and CC fee transactions are created automatically
          </li>
          <li>Driver commission is calculated and recorded</li>
          <li>A payment confirmation is sent to the passenger</li>
          <li>
            Payment data appears in the <strong>Square Payments</strong> report
          </li>
        </ul>
      </div>

      {/* Status Indicator */}
      {hasEvents ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
          <div className="text-xs text-green-800">
            <p className="font-medium">Webhook Status: Active ✓</p>
            <p className="text-green-700 mt-0.5">
              Square webhook events are being received! View them at{" "}
              <a href="/square-payments" className="underline font-medium">
                /square-payments
              </a>
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
          <div className="w-2 h-2 rounded-full bg-yellow-500 mt-1.5 flex-shrink-0" />
          <div className="text-xs text-yellow-800">
            <p className="font-medium">Webhook Status: Not Connected</p>
            <p className="text-yellow-700 mt-0.5">
              No Square webhook events have been received yet. Follow the setup
              instructions above to connect Square.
            </p>
          </div>
        </div>
      )}

      {/* Troubleshooting */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2">
        <p className="text-xs font-semibold text-gray-800">
          🔧 Troubleshooting
        </p>
        <ul className="text-xs text-gray-600 space-y-1.5 list-disc list-inside">
          <li>
            <strong>Webhook URL must be HTTPS</strong> — Square requires a
            secure connection
          </li>
          <li>
            <strong>Make sure the app is published</strong> — The webhook URL
            must be publicly accessible (not localhost)
          </li>
          <li>
            <strong>Check Square Developer Dashboard</strong> → Webhooks for
            delivery status and error logs
          </li>
          <li>
            <strong>Test with a small payment</strong> — Process a $1 test
            payment in Square to verify the webhook fires
          </li>
          <li>
            <strong>Check the Square Payments report</strong> at{" "}
            <a href="/square-payments" className="text-blue-600 underline">
              /square-payments
            </a>{" "}
            to see if events are arriving
          </li>
        </ul>
      </div>
    </div>
  );
}
