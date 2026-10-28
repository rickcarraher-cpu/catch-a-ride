import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { MessageSquare, XCircle } from "lucide-react";
import { toast } from "@/utils/notify";

export function MessagePassengerModal({
  client,
  trip,
  onClose,
  initialMessage = "",
}) {
  const [message, setMessage] = useState(initialMessage);
  const maxChars = 160;

  const mutation = useMutation({
    mutationFn: async (data) => {
      const res = await fetch("/api/sms/send-custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to send message");
      return json;
    },
    onSuccess: (data) => {
      const channels = [];
      if (data.results?.sms) channels.push("SMS");
      if (data.results?.email) channels.push("Email");
      const channelText =
        channels.length > 0 ? ` via ${channels.join(" & ")}` : "";
      toast.success(`Message sent successfully${channelText} ✓`);
      onClose();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to send message");
    },
  });

  const handleSend = () => {
    if (!message.trim()) {
      toast.error("Please enter a message");
      return;
    }

    if (!client?.phone && !client?.email) {
      toast.error("Passenger has no phone number or email");
      return;
    }

    mutation.mutate({
      client_id: client.id,
      phone: client.phone,
      email: client.email,
      name: client.name,
      message: message.trim(),
    });
  };

  const charsRemaining = maxChars - message.length;
  const isOverLimit = charsRemaining < 0;

  // Determine which channels will be used
  const notifPref = client?.notification_preference || "both";
  const willSendSms =
    (notifPref === "sms" || notifPref === "both") && client?.phone;
  const willSendEmail =
    (notifPref === "email" || notifPref === "both") && client?.email;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-md">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <MessageSquare size={20} className="text-blue-600" />
              Message Passenger
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              To: {client?.name || "Passenger"}
            </p>
            {trip?.booking_number && (
              <p className="text-xs text-gray-400 mt-0.5">
                #{trip.booking_number}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <XCircle size={24} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Channel indicator */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
            <p className="text-xs text-blue-700 font-medium flex items-center gap-1.5">
              {willSendSms && willSendEmail && (
                <>📧 📱 Will send via Email & SMS</>
              )}
              {willSendSms && !willSendEmail && <>📱 Will send via SMS only</>}
              {!willSendSms && willSendEmail && (
                <>📧 Will send via Email only</>
              )}
              {!willSendSms && !willSendEmail && (
                <>⚠️ No contact method available</>
              )}
            </p>
            {client?.phone && (
              <p className="text-[11px] text-blue-600 mt-1">
                Phone: {client.phone}
              </p>
            )}
            {client?.email && (
              <p className="text-[11px] text-blue-600 mt-0.5">
                Email: {client.email}
              </p>
            )}
            <p className="text-[11px] text-blue-600 mt-1">
              Preference:{" "}
              {notifPref === "both"
                ? "Email & SMS"
                : notifPref === "email"
                  ? "Email only"
                  : "SMS only"}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Message
              </label>
              {willSendSms && (
                <span
                  className={`text-xs font-medium ${
                    isOverLimit
                      ? "text-red-600"
                      : charsRemaining < 20
                        ? "text-amber-600"
                        : "text-gray-400"
                  }`}
                >
                  {charsRemaining} chars remaining
                </span>
              )}
            </div>
            <textarea
              className={`w-full px-3 py-2 bg-white border rounded-lg text-sm focus:ring-2 focus:ring-blue-600 min-h-[140px] ${
                isOverLimit && willSendSms
                  ? "border-red-300"
                  : "border-gray-200"
              }`}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message here... (e.g., 'Do you have any special requests?')"
              autoFocus
            />
            {willSendSms && (
              <div className="bg-amber-50 border border-amber-100 rounded-lg p-2.5">
                <p className="text-[11px] text-amber-700">
                  💬 Keep under 160 characters for best SMS delivery.{" "}
                  {willSendEmail &&
                    "Longer messages will also be sent via email."}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={mutation.isPending}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={
              mutation.isPending ||
              !message.trim() ||
              (isOverLimit && willSendSms && !willSendEmail)
            }
            className="px-6 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
          >
            {mutation.isPending ? (
              <>Sending...</>
            ) : (
              <>
                <MessageSquare size={16} />
                Send Message
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
