import { useState } from "react";
import { toast } from "@/utils/notify";
import { ArrowLeft, Clock, AlertCircle, CheckCircle } from "lucide-react";

export function SendMessageScreen({ onBack, onSuccess }) {
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    message: "",
    is_urgent: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate required fields
    const missing = [];
    if (!formData.name?.trim()) missing.push("Name");
    if (!formData.phone?.trim() && !formData.email?.trim()) {
      missing.push("Phone or Email");
    }
    if (!formData.message?.trim()) missing.push("Message");

    if (missing.length > 0) {
      toast.error(`Please fill in: ${missing.join(", ")}`);
      return;
    }

    setIsSubmitting(true);
    try {
      // Add timeout to prevent hanging indefinitely
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const res = await fetch("/api/appointments/message-only", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to send message");
      }

      const result = await res.json();
      toast.success("Message received! We'll get back to you soon.");

      // Show the "sent" confirmation screen
      setIsSent(true);

      // Try to close the window after a short delay
      setTimeout(() => {
        window.close();
      }, 3000);
    } catch (err) {
      console.error("Error sending message:", err);

      // Handle timeout error specifically
      if (err.name === "AbortError") {
        toast.error(
          "Request timed out. Please check your connection and try again.",
        );
      } else {
        toast.error(err.message || "Failed to send message. Please try again.");
      }

      setIsSubmitting(false);
    }
  };

  // ── Sent confirmation screen ──────────────────────────────────────────
  if (isSent) {
    return (
      <div className="space-y-8 text-center py-12">
        <div className="w-20 h-20 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle size={40} className="text-white" />
        </div>
        <div className="space-y-3">
          <h2 className="text-3xl font-extrabold text-gray-900">
            Message Sent!
          </h2>
          <p className="text-lg text-gray-600">
            Thank you for reaching out. We'll get back to you as soon as
            possible.
          </p>
        </div>
        <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-5 max-w-md mx-auto">
          <p className="text-sm text-blue-800 font-medium">
            You may now close this window.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-3">
        <h2 className="text-3xl font-extrabold text-gray-900">
          Send Us A Message
        </h2>
        <p className="text-lg text-gray-600">
          We'll review your inquiry and get back to you as soon as possible
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Name */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            Name <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => handleChange("name", e.target.value)}
            placeholder="Your full name"
            className="w-full px-4 py-3 bg-white border-2 border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none transition-all"
          />
        </div>

        {/* Phone */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            Phone
          </label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => handleChange("phone", e.target.value)}
            placeholder="(555) 123-4567"
            autoComplete="tel"
            className="w-full px-4 py-3 bg-white border-2 border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none transition-all"
          />
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            Email
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => handleChange("email", e.target.value)}
            placeholder="your@email.com"
            autoComplete="email"
            className="w-full px-4 py-3 bg-white border-2 border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none transition-all"
          />
          <p className="text-xs text-gray-500 mt-2">
            Provide phone, email, or both
          </p>
        </div>

        {/* Message */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            Message <span className="text-red-600">*</span>
          </label>
          <textarea
            value={formData.message}
            onChange={(e) => handleChange("message", e.target.value)}
            placeholder="What can we help you with?"
            rows={6}
            className="w-full px-4 py-3 bg-white border-2 border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none transition-all resize-none"
          />
        </div>

        {/* Urgent Toggle */}
        <div>
          <button
            type="button"
            onClick={() => handleChange("is_urgent", !formData.is_urgent)}
            className={`w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-semibold transition-all border-2 ${
              formData.is_urgent
                ? "bg-red-50 border-red-500 text-red-700"
                : "bg-gray-50 border-gray-300 text-gray-700 hover:border-gray-400"
            }`}
          >
            <AlertCircle size={20} />
            {formData.is_urgent ? "🔴 Marked as Urgent" : "Mark as Urgent"}
          </button>
          {formData.is_urgent && (
            <p className="text-xs text-red-600 mt-2 text-center font-medium">
              This message will be flagged for priority attention
            </p>
          )}
        </div>

        {/* Business Hours Warning */}
        <div className="bg-blue-50 border-2 border-blue-300 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
              <Clock size={20} className="text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-blue-900 mb-1">
                After-Hours Submissions
              </p>
              <p className="text-sm text-blue-800 leading-relaxed">
                Please be aware that if this is sent outside of business hours,
                it will not be processed until after 8 am. Thank you.
              </p>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-4 pt-4">
          <button
            type="button"
            onClick={onBack}
            disabled={isSubmitting}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 hover:bg-gray-200 border-2 border-gray-300 text-gray-900 font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowLeft size={20} />
            Back
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-bold rounded-xl shadow-xl shadow-emerald-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Sending..." : "Send Message"}
          </button>
        </div>
      </form>
    </div>
  );
}
