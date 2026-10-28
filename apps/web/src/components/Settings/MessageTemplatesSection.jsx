import { useState, useEffect } from "react";
import { Mail, MessageSquare, Eye, Sparkles } from "lucide-react";

const TEMPLATE_TYPES = [
  {
    id: "booking_created",
    label: "Booking Confirmation",
    description: "Sent when a new trip is created",
    icon: "✓",
    color: "green",
  },
  {
    id: "booking_changed",
    label: "Booking Updated",
    description: "Sent when trip details are modified",
    icon: "✎",
    color: "blue",
  },
  {
    id: "booking_deleted",
    label: "Booking Cancelled",
    description: "Sent when a trip is cancelled",
    icon: "✕",
    color: "red",
  },
  {
    id: "reminder_day_before",
    label: "Day-Before Reminder",
    description: "Sent 24 hours before the trip",
    icon: "⏰",
    color: "amber",
  },
  {
    id: "driver_assigned",
    label: "Driver Assigned",
    description: "Sent when a driver is assigned to a trip",
    icon: "👤",
    color: "purple",
  },
  {
    id: "payment_confirmed",
    label: "Payment Confirmed",
    description: "Sent when payment is received",
    icon: "💳",
    color: "green",
  },
  {
    id: "refund_processed",
    label: "Refund Processed",
    description: "Sent when a refund is issued",
    icon: "↩",
    color: "orange",
  },
  {
    id: "followup",
    label: "Thank You Follow-Up",
    description: "Sent 24 hours after trip completion",
    icon: "❤️",
    color: "pink",
  },
];

const AVAILABLE_VARIABLES = {
  common: [
    { var: "{name}", desc: "Passenger first name" },
    { var: "{business}", desc: "Your business name" },
    { var: "{code}", desc: "Booking number" },
    { var: "{link}", desc: "View booking details link" },
  ],
  trip: [
    { var: "{date}", desc: "Trip date (e.g., Monday, Jan 15, 2025)" },
    { var: "{time}", desc: "Trip time (e.g., 3:30 PM)" },
    { var: "{driver}", desc: "Driver name" },
    { var: "{vehicle}", desc: "Vehicle name" },
  ],
  payment: [
    { var: "{amount}", desc: "Payment amount" },
    { var: "{payment_method}", desc: "Payment method" },
    { var: "{payment_link}", desc: "Payment link URL" },
  ],
  followup: [{ var: "{review_link}", desc: "Google review link" }],
};

const DEFAULT_TEMPLATES = {
  booking_created: {
    sms: "Hi {name}, your trip with {business} is confirmed for {date} at {time}. Driver: {driver}. Booking Code: #{code}.\n\nShow Booking Details: {link}\n\nReply STOP to opt out of messages.",
    email_subject: "Your trip is confirmed — Booking #{code}",
    email_body:
      "Hi {name},\n\nYour trip with {business} is confirmed!\n\nDate: {date}\nTime: {time}\nDriver: {driver}\nBooking Code: #{code}\n\nWe look forward to serving you!\n\n— {business}",
  },
  booking_changed: {
    sms: "Hi {name}, your trip with {business} (Booking #{code}) has been updated.\n\nDate: {date}\nTime: {time}\nDriver: {driver}\n\nShow Booking Details: {link}\n\nReply STOP to opt out of messages.",
    email_subject: "Your trip has been updated — Booking #{code}",
    email_body:
      "Hi {name},\n\nYour trip with {business} has been updated.\n\nNew Date: {date}\nNew Time: {time}\nDriver: {driver}\nBooking Code: #{code}\n\nView Details: {link}\n\n— {business}",
  },
  booking_deleted: {
    sms: "Hi {name}, your trip with {business} (Booking #{code}) has been cancelled.\n\nReply STOP to opt out of messages.",
    email_subject: "Trip Cancelled — Booking #{code}",
    email_body:
      "Hi {name},\n\nYour trip with {business} has been cancelled.\n\nBooking Code: #{code}\nOriginal Date: {date}\nOriginal Time: {time}\n\nIf you have any questions or would like to rebook, please don't hesitate to reach out.\n\n— {business}",
  },
  reminder_day_before: {
    sms: "Hi {name}, reminder: your trip with {business} is tomorrow at {time}. Driver: {driver}. Booking #{code}.\n\nShow Details: {link}\n\nReply STOP to opt out of messages.",
    email_subject: "Reminder: Your trip is tomorrow — Booking #{code}",
    email_body:
      "Hi {name},\n\nThis is a friendly reminder that your trip with {business} is tomorrow!\n\nDate: {date}\nTime: {time}\nDriver: {driver}\nBooking Code: #{code}\n\nWe look forward to serving you!\n\n— {business}",
  },
  driver_assigned: {
    sms: "Hi {name}, {driver} has been assigned to your trip (Booking #{code}) on {date} at {time}. Vehicle: {vehicle}.\n\nShow Details: {link}\n\nReply STOP to opt out of messages.",
    email_subject: "Driver Assigned — Booking #{code}",
    email_body:
      "Hi {name},\n\n{driver} has been assigned to your trip!\n\nDate: {date}\nTime: {time}\nDriver: {driver}\nVehicle: {vehicle}\nBooking Code: #{code}\n\nView Details: {link}\n\n— {business}",
  },
  payment_confirmed: {
    sms: "Hi {name}, your payment of ${amount} for trip #{code} with {business} has been received via {payment_method}. Thank you!\n\nShow Details: {link}\n\nReply STOP to opt out of messages.",
    email_subject: "Payment Received — Booking #{code}",
    email_body:
      "Hi {name},\n\nThank you! We've received your payment of ${amount} for your trip with {business}.\n\nBooking Code: #{code}\nPayment Method: {payment_method}\nAmount Paid: ${amount}\nDate: {date}\nTime: {time}\n\nWe look forward to serving you!\n\n— {business}",
  },
  refund_processed: {
    sms: "Hi {name}, a refund of ${amount} has been processed for trip #{code} with {business}. You should see this in your account within 3-5 business days.\n\nReply STOP to opt out of messages.",
    email_subject: "Refund Processed — Booking #{code}",
    email_body:
      "Hi {name},\n\nA refund of ${amount} has been processed for your trip with {business}.\n\nBooking Code: #{code}\nRefund Amount: ${amount}\n\nYou should see this in your account within 3-5 business days.\n\n— {business}",
  },
  followup: {
    sms: "Thank you for choosing {business}! We hope you had a wonderful trip. We'd love to hear about your experience — please take a moment to leave us a review: {review_link}",
    email_subject: "Thank you for choosing {business}!",
    email_body:
      "Hi {name},\n\nThank you for choosing {business}! We hope you had a wonderful trip.\n\nWe'd love to hear about your experience. Your feedback helps us serve you better!\n\nLeave a Review: {review_link}\n\nNeed another ride? Book with us again!\n\n— {business}",
  },
};

function VariableChip({ variable, description, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded text-xs font-mono text-blue-700 transition-colors"
      title={`Click to insert: ${description}`}
    >
      <code>{variable}</code>
    </button>
  );
}

function TemplateEditor({
  type,
  settings,
  handleUpdate,
  businessName,
  reviewLink,
}) {
  const template = TEMPLATE_TYPES.find((t) => t.id === type);
  const defaults = DEFAULT_TEMPLATES[type];

  const [localSms, setLocalSms] = useState("");
  const [localEmailSubject, setLocalEmailSubject] = useState("");
  const [localEmailBody, setLocalEmailBody] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  const smsKey = `template_${type}_sms`;
  const emailSubjectKey = `template_${type}_email_subject`;
  const emailBodyKey = `template_${type}_email_body`;

  // Sync from server settings
  useEffect(() => {
    setLocalSms(settings?.[smsKey] || defaults.sms);
  }, [settings?.[smsKey], defaults.sms, smsKey]);

  useEffect(() => {
    setLocalEmailSubject(settings?.[emailSubjectKey] || defaults.email_subject);
  }, [settings?.[emailSubjectKey], defaults.email_subject, emailSubjectKey]);

  useEffect(() => {
    setLocalEmailBody(settings?.[emailBodyKey] || defaults.email_body);
  }, [settings?.[emailBodyKey], defaults.email_body, emailBodyKey]);

  const insertVariable = (field, variable) => {
    if (field === "sms") {
      setLocalSms((prev) => prev + variable);
    } else if (field === "email_subject") {
      setLocalEmailSubject((prev) => prev + variable);
    } else if (field === "email_body") {
      setLocalEmailBody((prev) => prev + variable);
    }
  };

  const resetToDefault = (field) => {
    if (field === "sms") {
      setLocalSms(defaults.sms);
      handleUpdate(smsKey, defaults.sms);
    } else if (field === "email_subject") {
      setLocalEmailSubject(defaults.email_subject);
      handleUpdate(emailSubjectKey, defaults.email_subject);
    } else if (field === "email_body") {
      setLocalEmailBody(defaults.email_body);
      handleUpdate(emailBodyKey, defaults.email_body);
    }
  };

  const previewText = (text) => {
    return text
      .replace(/\{name\}/gi, "John")
      .replace(/\{business\}/gi, businessName || "Your Business")
      .replace(/\{code\}/gi, "12345")
      .replace(/\{date\}/gi, "Monday, January 15, 2025")
      .replace(/\{time\}/gi, "3:30 PM")
      .replace(/\{driver\}/gi, "Mike Smith")
      .replace(/\{vehicle\}/gi, "Black SUV")
      .replace(/\{amount\}/gi, "150.00")
      .replace(/\{payment_method\}/gi, "Credit Card")
      .replace(/\{link\}/gi, "https://yoursite.com/booking/12345")
      .replace(/\{payment_link\}/gi, "https://yoursite.com/pay/12345")
      .replace(/\{review_link\}/gi, reviewLink || "https://g.page/r/...");
  };

  const colorClasses = {
    green: "from-green-50 to-emerald-50 border-green-200",
    blue: "from-blue-50 to-cyan-50 border-blue-200",
    red: "from-red-50 to-rose-50 border-red-200",
    amber: "from-amber-50 to-yellow-50 border-amber-200",
    purple: "from-purple-50 to-fuchsia-50 border-purple-200",
    orange: "from-orange-50 to-amber-50 border-orange-200",
    pink: "from-pink-50 to-rose-50 border-pink-200",
  };

  return (
    <div
      className={`bg-gradient-to-br ${colorClasses[template.color]} border rounded-lg p-5 space-y-4`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{template.icon}</span>
          <div>
            <h4 className="text-sm font-semibold text-gray-800">
              {template.label}
            </h4>
            <p className="text-xs text-gray-500">{template.description}</p>
          </div>
        </div>
        <button
          onClick={() => setShowPreview(!showPreview)}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Eye size={12} />
          {showPreview ? "Hide" : "Show"} Preview
        </button>
      </div>

      {/* SMS Template */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare size={14} className="text-gray-600" />
            <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
              SMS Message
            </label>
          </div>
          <button
            onClick={() => resetToDefault("sms")}
            className="text-xs text-blue-600 hover:underline"
          >
            Reset to default
          </button>
        </div>
        <textarea
          value={localSms}
          onChange={(e) => setLocalSms(e.target.value)}
          onBlur={() => handleUpdate(smsKey, localSms)}
          rows={5}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono bg-white"
        />
        <div className="flex flex-wrap gap-1">
          {AVAILABLE_VARIABLES.common.map((v) => (
            <VariableChip
              key={v.var}
              variable={v.var}
              description={v.desc}
              onClick={() => insertVariable("sms", v.var)}
            />
          ))}
          {type !== "followup" &&
            AVAILABLE_VARIABLES.trip.map((v) => (
              <VariableChip
                key={v.var}
                variable={v.var}
                description={v.desc}
                onClick={() => insertVariable("sms", v.var)}
              />
            ))}
          {(type === "payment_confirmed" || type === "booking_created") &&
            AVAILABLE_VARIABLES.payment.map((v) => (
              <VariableChip
                key={v.var}
                variable={v.var}
                description={v.desc}
                onClick={() => insertVariable("sms", v.var)}
              />
            ))}
          {type === "followup" &&
            AVAILABLE_VARIABLES.followup.map((v) => (
              <VariableChip
                key={v.var}
                variable={v.var}
                description={v.desc}
                onClick={() => insertVariable("sms", v.var)}
              />
            ))}
        </div>
        {showPreview && (
          <div className="mt-2 p-3 bg-white border border-gray-300 rounded-lg">
            <p className="text-xs font-semibold text-gray-600 mb-2">
              SMS Preview:
            </p>
            <p className="text-xs text-gray-700 whitespace-pre-wrap">
              {previewText(localSms)}
            </p>
          </div>
        )}
      </div>

      {/* Email Template */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail size={14} className="text-gray-600" />
            <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
              Email Subject
            </label>
          </div>
          <button
            onClick={() => resetToDefault("email_subject")}
            className="text-xs text-blue-600 hover:underline"
          >
            Reset to default
          </button>
        </div>
        <input
          type="text"
          value={localEmailSubject}
          onChange={(e) => setLocalEmailSubject(e.target.value)}
          onBlur={() => handleUpdate(emailSubjectKey, localEmailSubject)}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono bg-white"
        />
        <div className="flex flex-wrap gap-1">
          {AVAILABLE_VARIABLES.common.map((v) => (
            <VariableChip
              key={v.var}
              variable={v.var}
              description={v.desc}
              onClick={() => insertVariable("email_subject", v.var)}
            />
          ))}
        </div>
        {showPreview && (
          <div className="mt-2 p-3 bg-white border border-gray-300 rounded-lg">
            <p className="text-xs font-semibold text-gray-600 mb-2">
              Subject Preview:
            </p>
            <p className="text-xs text-gray-700">
              {previewText(localEmailSubject)}
            </p>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
            Email Body
          </label>
          <button
            onClick={() => resetToDefault("email_body")}
            className="text-xs text-blue-600 hover:underline"
          >
            Reset to default
          </button>
        </div>
        <textarea
          value={localEmailBody}
          onChange={(e) => setLocalEmailBody(e.target.value)}
          onBlur={() => handleUpdate(emailBodyKey, localEmailBody)}
          rows={8}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono bg-white"
        />
        <div className="flex flex-wrap gap-1">
          {AVAILABLE_VARIABLES.common.map((v) => (
            <VariableChip
              key={v.var}
              variable={v.var}
              description={v.desc}
              onClick={() => insertVariable("email_body", v.var)}
            />
          ))}
          {type !== "followup" &&
            AVAILABLE_VARIABLES.trip.map((v) => (
              <VariableChip
                key={v.var}
                variable={v.var}
                description={v.desc}
                onClick={() => insertVariable("email_body", v.var)}
              />
            ))}
          {(type === "payment_confirmed" || type === "booking_created") &&
            AVAILABLE_VARIABLES.payment.map((v) => (
              <VariableChip
                key={v.var}
                variable={v.var}
                description={v.desc}
                onClick={() => insertVariable("email_body", v.var)}
              />
            ))}
          {type === "followup" &&
            AVAILABLE_VARIABLES.followup.map((v) => (
              <VariableChip
                key={v.var}
                variable={v.var}
                description={v.desc}
                onClick={() => insertVariable("email_body", v.var)}
              />
            ))}
        </div>
        {showPreview && (
          <div className="mt-2 p-3 bg-white border border-gray-300 rounded-lg">
            <p className="text-xs font-semibold text-gray-600 mb-2">
              Body Preview:
            </p>
            <p className="text-xs text-gray-700 whitespace-pre-wrap">
              {previewText(localEmailBody)}
            </p>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-500 italic">
        💡 Click outside the text boxes to save your changes
      </p>
    </div>
  );
}

export function MessageTemplatesSection({ settings, handleUpdate }) {
  const businessName = settings?.business_name || "Your Business";
  const reviewLink =
    settings?.google_review_link || "https://g.page/r/YOUR_REVIEW_LINK/review";

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={18} className="text-blue-600" />
          <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">
            Customize Your Messages
          </h3>
        </div>
        <p className="text-xs text-gray-600 leading-relaxed mb-3">
          Personalize every email and SMS sent to your passengers. Use variables
          like <code className="bg-white px-1 py-0.5 rounded">{"{name}"}</code>{" "}
          and <code className="bg-white px-1 py-0.5 rounded">{"{date}"}</code>{" "}
          to automatically insert trip details.
        </p>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-blue-200 rounded text-xs font-medium text-blue-700">
            <MessageSquare size={12} />
            SMS Templates
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-blue-200 rounded text-xs font-medium text-blue-700">
            <Mail size={12} />
            Email Templates
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-blue-200 rounded text-xs font-medium text-blue-700">
            <Eye size={12} />
            Live Preview
          </span>
        </div>
      </div>

      {TEMPLATE_TYPES.map((template) => (
        <TemplateEditor
          key={template.id}
          type={template.id}
          settings={settings}
          handleUpdate={handleUpdate}
          businessName={businessName}
          reviewLink={reviewLink}
        />
      ))}
    </div>
  );
}
