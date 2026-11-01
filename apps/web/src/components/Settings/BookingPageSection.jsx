import { useState } from "react";
import { MessageSquare, Copy } from "lucide-react";
import { toast } from "@/utils/notify";

export function BookingPageSection({ settings, handleUpdate }) {
  const [newTourEmail, setNewTourEmail] = useState("");

  const tourEmails = (settings?.tour_authorized_emails || "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  const handleAddTourEmail = () => {
    const email = newTourEmail.trim().toLowerCase();
    if (!email) return;
    if (tourEmails.includes(email)) {
      setNewTourEmail("");
      return;
    }
    const updated = [...tourEmails, email].join(", ");
    handleUpdate("tour_authorized_emails", updated);
    setNewTourEmail("");
  };

  const handleRemoveTourEmail = (emailToRemove) => {
    const updated = tourEmails.filter((e) => e !== emailToRemove).join(", ");
    handleUpdate("tour_authorized_emails", updated);
  };

  return (
    <section className="bg-white p-6 rounded-xl border border-gray-200 space-y-4">
      <div className="flex items-center gap-2 text-gray-900 mb-2">
        <MessageSquare size={18} className="text-blue-600" />
        <h2 className="font-semibold text-lg">Booking Page Settings</h2>
      </div>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Booking Message (Max 300 chars)
          </label>
          <textarea
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 min-h-[100px]"
            defaultValue={settings?.booking_message}
            maxLength={300}
            onBlur={(e) => handleUpdate("booking_message", e.target.value)}
            placeholder="Welcome to our booking page..."
          />
        </div>

        {/* NEW: Welcome Screen Toggle */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div>
            <p className="text-sm font-semibold text-gray-900">
              Show Welcome Screen
            </p>
            <p className="text-xs text-gray-500">
              Display the welcome screen before passengers start booking
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={settings?.require_welcome_screen === "yes"}
              onChange={(e) =>
                handleUpdate(
                  "require_welcome_screen",
                  e.target.checked ? "yes" : "no",
                )
              }
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {/* Tour Booking Toggle */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div>
            <p className="text-sm font-semibold text-gray-900">
              🚌 Enable Tour Booking
            </p>
            <p className="text-xs text-gray-500">
              When enabled, all admin users will see the Tours section on the
              dashboard and can book and manage tours
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={settings?.enable_tour_booking === "yes"}
              onChange={(e) =>
                handleUpdate(
                  "enable_tour_booking",
                  e.target.checked ? "yes" : "no",
                )
              }
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
          </label>
        </div>

        {/* Tour access info — shown when tour booking is enabled */}
        {settings?.enable_tour_booking === "yes" && (
          <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <p className="text-sm font-semibold text-gray-900">
              🚌 Tour Access
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Tours are visible to all admin dashboard users. No per-email
              authorization is required.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-sm font-semibold text-gray-900">
            Public Booking URL
          </p>
          <p className="text-xs text-gray-500">
            Share this with your passengers — uses the step-by-step booking
            wizard.
          </p>
          <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <a
              href="/book/catch-a-ride"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-sm font-medium text-blue-600 hover:underline break-all"
            >
              {typeof window !== "undefined"
                ? `${window.location.origin}/book/catch-a-ride`
                : "/book/catch-a-ride"}
            </a>
            <button
              onClick={() => {
                const url = `${window.location.origin}/book/catch-a-ride`;
                navigator.clipboard.writeText(url);
                toast.success("Booking URL copied!");
              }}
              className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 text-gray-500 shrink-0"
              title="Copy URL"
            >
              <Copy size={15} />
            </button>
          </div>
        </div>
        {/* Wizard Booking URL section removed — /book/[slug] now uses the wizard by default */}
      </div>
    </section>
  );
}
