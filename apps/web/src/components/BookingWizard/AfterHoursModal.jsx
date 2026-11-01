import { Moon, Phone, Clock, ArrowRight, Sun } from "lucide-react";

/**
 * Format a 24-hour "HH:MM" string to a human-readable 12-hour time.
 * e.g. "08:00" → "8:00 AM", "17:30" → "5:30 PM"
 */
function formatTime(hhmm) {
  if (!hhmm) return "";
  const [hourStr, minuteStr] = hhmm.split(":");
  let hour = parseInt(hourStr, 10);
  const minute = minuteStr || "00";
  const ampm = hour >= 12 ? "PM" : "AM";
  if (hour === 0) hour = 12;
  else if (hour > 12) hour -= 12;
  return `${hour}:${minute} ${ampm}`;
}

/**
 * Get current time in America/Chicago as "HH:MM" (24-hour, zero-padded).
 */
function getCurrentCentralTime() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const hour = (parts.find((p) => p.type === "hour")?.value || "12").replace(
    "24",
    "00",
  );
  const minute = parts.find((p) => p.type === "minute")?.value || "00";
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

export function AfterHoursModal({ settings, onContinue }) {
  const start = settings?.business_hours_start || "06:00";
  const end = settings?.business_hours_end || "20:00";
  const businessPhone = settings?.business_phone;

  // Check if currently after hours
  const currentTime = getCurrentCentralTime();
  const isAfterHours = currentTime < start || currentTime >= end;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="relative bg-gradient-to-br from-slate-800 to-indigo-900 rounded-3xl shadow-2xl max-w-md w-full border border-indigo-400/30 overflow-hidden">
        {/* Decorative glow */}
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative p-8 text-center space-y-6">
          {/* Icon */}
          <div
            className={`inline-flex items-center justify-center w-20 h-20 rounded-full border-2 shadow-lg ${
              isAfterHours
                ? "bg-indigo-500/20 border-indigo-400/60 shadow-indigo-500/30"
                : "bg-amber-500/20 border-amber-400/60 shadow-amber-500/30"
            }`}
          >
            {isAfterHours ? (
              <Moon size={36} className="text-indigo-300" />
            ) : (
              <Sun size={36} className="text-amber-300" />
            )}
          </div>

          {/* Heading */}
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white tracking-tight">
              {isAfterHours ? "We're Currently Closed" : "Business Hours"}
            </h2>
            <p className="text-indigo-200 text-sm leading-relaxed">
              {isAfterHours
                ? "You're reaching us outside of our normal business hours. You can still submit your request — we'll get back to you as soon as we're open."
                : `Please be aware that if this is sent outside of business hours, it will not be processed until after ${formatTime(start)}. Thank you.`}
            </p>
          </div>

          {/* Business Hours Card */}
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-center gap-2 text-indigo-200 mb-3">
              <Clock size={16} />
              <span className="text-xs font-semibold uppercase tracking-widest">
                Business Hours
              </span>
            </div>
            <p className="text-white font-bold text-lg">
              {formatTime(start)} – {formatTime(end)}
            </p>
            <p className="text-indigo-300 text-xs">Daily — 7 days a week</p>
          </div>

          {/* Phone */}
          {businessPhone && (
            <div className="space-y-1">
              <p className="text-indigo-300 text-xs font-medium">
                Need immediate assistance?
              </p>
              <a
                href={`tel:${businessPhone}`}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold rounded-xl transition-all"
              >
                <Phone size={16} className="text-green-400" />
                {businessPhone}
              </a>
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-white/10" />

          {/* CTA */}
          <div className="space-y-3">
            <button
              onClick={onContinue}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-6 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold rounded-xl transition-all hover:scale-105 shadow-lg shadow-purple-500/40"
            >
              Continue
              <ArrowRight size={18} />
            </button>
            {isAfterHours && (
              <p className="text-indigo-300/70 text-xs">
                Your request will be reviewed when we open.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
