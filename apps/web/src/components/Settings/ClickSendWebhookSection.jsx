import React, { useState } from "react";
import { Copy, Check, ExternalLink } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export function ClickSendWebhookSection() {
  const [copied, setCopied] = useState(false);

  // Get the webhook URL from the current domain
  const webhookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/sms/webhook`
      : "https://your-domain.com/api/sms/webhook";

  // Check if any messages have been received
  const { data: messagesData } = useQuery({
    queryKey: ["sms-messages-check"],
    queryFn: async () => {
      const res = await fetch("/api/sms/messages");
      if (!res.ok) return { messages: [] };
      return res.json();
    },
  });

  const hasMessages = (messagesData?.messages || []).length > 0;

  const handleCopy = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">
          ClickSend Webhook Configuration
        </h3>
        <p className="text-xs text-gray-400 mt-1">
          Configure ClickSend to forward incoming SMS replies to your Messages
          inbox
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
              href="https://dashboard.clicksend.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-medium hover:text-blue-600"
            >
              ClickSend Dashboard
              <ExternalLink size={10} className="inline ml-0.5 mb-0.5" />
            </a>
          </li>
          <li>
            Navigate to <strong>SMS</strong> → <strong>Settings</strong> →{" "}
            <strong>Inbound Settings</strong>
          </li>
          <li>
            Find the <strong>"Reply Webhook URL"</strong> or{" "}
            <strong>"Inbound SMS URL"</strong> field
          </li>
          <li>Paste your webhook URL (copied above) into that field</li>
          <li>
            Set the HTTP method to <strong>POST</strong>
          </li>
          <li>
            Click <strong>Save</strong>
          </li>
        </ol>
      </div>

      {/* Status Indicator */}
      {hasMessages ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
          <div className="text-xs text-green-800">
            <p className="font-medium">Webhook Status: Active ✓</p>
            <p className="text-green-700 mt-0.5">
              Your webhook is receiving messages! Incoming SMS replies appear in
              your Messages inbox at <strong>/messages</strong>
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
          <div className="w-2 h-2 rounded-full bg-yellow-500 mt-1.5 flex-shrink-0" />
          <div className="text-xs text-yellow-800">
            <p className="font-medium">Webhook Status: Pending Configuration</p>
            <p className="text-yellow-700 mt-0.5">
              Once configured in ClickSend, incoming SMS replies will appear in
              your Messages inbox at <strong>/messages</strong>
            </p>
          </div>
        </div>
      )}

      {/* Test Instructions */}
      <div className="border-t border-gray-200 pt-4 space-y-3">
        <p className="text-xs font-medium text-gray-700 mb-2">🧪 How to Test</p>
        <ol className="text-xs text-gray-600 space-y-1.5 list-decimal list-inside">
          <li>Complete the webhook setup above</li>
          <li>
            <strong>Verify webhook is reachable:</strong> Visit{" "}
            <a
              href="/api/sms/webhook"
              target="_blank"
              className="text-blue-600 underline hover:text-blue-700"
            >
              {webhookUrl}
            </a>{" "}
            in your browser — you should see a JSON response with "status": "ok"
          </li>
          <li>Send a test SMS to a passenger from the Messages page</li>
          <li>Have them reply to the message</li>
          <li>
            Check your Messages inbox — the reply should appear within seconds
          </li>
          <li>
            <strong>If replies don't appear:</strong> Check the browser console
            on the Messages page for webhook logs, or contact support
          </li>
        </ol>
      </div>

      {/* Troubleshooting */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2">
        <p className="text-xs font-semibold text-gray-800">
          🔧 Troubleshooting
        </p>
        <ul className="text-xs text-gray-600 space-y-1.5 list-disc list-inside">
          <li>
            <strong>Webhook URL must be HTTPS</strong> — ClickSend requires a
            secure connection
          </li>
          <li>
            <strong>Check ClickSend Dashboard</strong> → SMS → Settings →
            Inbound Settings for webhook status
          </li>
          <li>
            <strong>Verify HTTP method is POST</strong> in ClickSend settings
          </li>
          <li>
            <strong>Test the webhook URL</strong> by clicking the link above —
            it should return a JSON response
          </li>
          <li>
            <strong>Check server logs</strong> for incoming webhook requests
            (look for "[SMS Webhook]" in logs)
          </li>
        </ul>
      </div>
    </div>
  );
}
