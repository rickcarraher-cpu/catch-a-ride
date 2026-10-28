"use client";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Printer,
  AlertTriangle,
  ArrowLeft,
  MessageSquare,
  Send,
  Phone,
  X,
} from "lucide-react";
import { toast } from "@/utils/notify";

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(dateStr) {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatReturnDate(dateStr) {
  if (!dateStr) return "";
  // Extract YYYY-MM-DD directly from ISO string to avoid CDT timezone shifting
  // midnight UTC dates back one day (e.g. 2026-06-15T00:00:00Z → Jun 14 in CDT)
  const str =
    typeof dateStr === "string" ? dateStr : new Date(dateStr).toISOString();
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return "";
  const [, year, month, day] = match;
  const d = new Date(`${year}-${month}-${day}T12:00:00Z`);
  return d.toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  });
}

function toLocalDate(dateStr) {
  // Returns YYYY-MM-DD in CDT
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-CA", {
    timeZone: "America/Chicago",
  });
}

function getTodayInCDT() {
  const now = new Date();
  return now.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}

export default function PrintSchedulePage() {
  const [selectedDate, setSelectedDate] = useState(() => getTodayInCDT());
  const [messageModal, setMessageModal] = useState(null);

  const { data: trips = [], isLoading } = useQuery({
    queryKey: ["print-schedule-trips", selectedDate],
    queryFn: async () => {
      const params = new URLSearchParams({
        start: selectedDate + "T00:00:00-05:00",
        end: selectedDate + "T23:59:59-05:00",
        limit: "500",
      });
      const res = await fetch(`/api/appointments?${params}`);
      if (!res.ok) throw new Error("Failed to load trips");
      const data = await res.json();
      return Array.isArray(data) ? data : data.appointments || [];
    },
    enabled: !!selectedDate,
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ["drivers"],
    queryFn: async () => {
      const res = await fetch("/api/employees");
      if (!res.ok) throw new Error("Failed to load drivers");
      return res.json();
    },
  });

  const { data: settings = {} } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const res = await fetch("/api/settings");
      if (!res.ok) return {};
      return res.json();
    },
  });

  const companyName = settings?.company_name || "Schedule";

  // Filter out cancelled and tentative trips for the selected date
  const activeTrips = trips.filter((t) => {
    if (t.status === "cancelled") return false;
    if (t.is_tentative) return false;
    const tripDate = toLocalDate(t.start_time);
    return tripDate === selectedDate;
  });

  // Sort by start_time
  const sorted = [...activeTrips].sort(
    (a, b) => new Date(a.start_time) - new Date(b.start_time),
  );

  // Group by date then by driver
  const byDate = {};
  sorted.forEach((t) => {
    const date = toLocalDate(t.start_time);
    if (!byDate[date]) byDate[date] = {};
    const driverKey = t.employee_id ? String(t.employee_id) : "unassigned";
    if (!byDate[date][driverKey]) byDate[date][driverKey] = [];
    byDate[date][driverKey].push(t);
  });

  const dates = Object.keys(byDate).sort();

  // Build driver map for color/name lookup
  const driverMap = {};
  drivers.forEach((d) => {
    driverMap[String(d.id)] = d;
  });

  const unassignedInRange = sorted.filter((t) => !t.employee_id);

  return (
    <>
      {/* Print CSS */}
      <style>{`
        @media print {
          body { font-size: 9pt; }
          .no-print { display: none !important; }
          .page-break { page-break-before: always; }
          .print-page { padding: 0.3in; }
          thead { display: table-header-group; }
          tr { page-break-inside: avoid; }
          @page { margin: 0.3in; size: landscape; }
          .print-date-block { page-break-inside: avoid; }
        }
      `}</style>

      {/* Controls - hidden on print */}
      <div className="no-print space-y-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <a
              href="/dashboard"
              className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors mb-2"
            >
              <ArrowLeft size={16} />
              Back to Dashboard
            </a>
            <h1 className="text-2xl font-semibold text-gray-900">
              Print Schedule by Driver
            </h1>
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Printer size={16} />
            Print
          </button>
        </div>

        <div className="flex items-center gap-4 bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex-1">
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">
              Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="text-sm text-gray-500 border-l border-gray-200 pl-4 ml-2">
            <span className="font-semibold text-gray-800">{sorted.length}</span>{" "}
            trips
            {unassignedInRange.length > 0 && (
              <span className="ml-2 text-amber-600 flex items-center gap-1 text-xs font-medium">
                <AlertTriangle size={12} />
                {unassignedInRange.length} unassigned
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Printable Schedule */}
      <div className="print-page">
        {/* Print Header */}
        <div className="mb-3 pb-2 border-b-2 border-gray-800 flex items-baseline justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">{companyName}</h1>
            <p className="text-xs text-gray-500 font-medium">
              Driver Schedule — {formatDate(selectedDate + "T12:00:00")}
            </p>
          </div>
          <p className="text-[10px] text-gray-400">
            Printed{" "}
            {new Date().toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
        </div>

        {isLoading ? (
          <p className="text-gray-400 py-8 text-center">Loading…</p>
        ) : dates.length === 0 ? (
          <p className="text-gray-400 py-8 text-center text-sm">
            No trips found for this date range.
          </p>
        ) : (
          <div className="space-y-5">
            {dates.map((date) => {
              const driverGroups = byDate[date];
              const driverKeys = Object.keys(driverGroups).sort((a, b) => {
                if (a === "unassigned") return 1;
                if (b === "unassigned") return -1;
                const dA = driverMap[a];
                const dB = driverMap[b];
                return (dA?.name || "").localeCompare(dB?.name || "");
              });

              const totalForDay = driverKeys.reduce(
                (sum, k) => sum + driverGroups[k].length,
                0,
              );

              return (
                <div key={date} className="print-date-block">
                  {/* Date Header */}
                  <div className="bg-gray-900 text-white px-3 py-1.5 rounded-t-md flex items-baseline justify-between">
                    <h2 className="text-xs font-bold tracking-wide">
                      {new Date(date + "T12:00:00").toLocaleDateString(
                        "en-US",
                        {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        },
                      )}
                    </h2>
                    <span className="text-[10px] text-gray-300 font-medium">
                      {totalForDay} trip{totalForDay !== 1 ? "s" : ""}
                    </span>
                  </div>

                  <div className="border border-gray-300 rounded-b-md overflow-hidden">
                    {(() => {
                      // Flatten all trips in driver order, keeping driver metadata on each trip
                      const allTripsFlat = [];
                      driverKeys.forEach((driverKey) => {
                        const driverTrips = driverGroups[driverKey];
                        const driver =
                          driverKey === "unassigned"
                            ? null
                            : driverMap[driverKey];
                        driverTrips.forEach((trip) => {
                          allTripsFlat.push({ trip, driver, driverKey });
                        });
                      });

                      return allTripsFlat.map(
                        ({ trip, driver, driverKey }, flatIdx) => {
                          const bagInfo = [
                            trip.num_bags_checked
                              ? `${trip.num_bags_checked}ck`
                              : "",
                            trip.num_bags_carry_on
                              ? `${trip.num_bags_carry_on}co`
                              : "",
                          ]
                            .filter(Boolean)
                            .join(" ");

                          const driverColor = driver ? driver.color : "#ca8a04";

                          return (
                            <div
                              key={trip.id}
                              className={
                                flatIdx > 0 ? "border-t-2 border-gray-400" : ""
                              }
                            >
                              {/* Column headers above this trip */}
                              <table className="w-full text-[10px] border-collapse">
                                <thead>
                                  <tr
                                    className="border-b border-gray-200"
                                    style={{
                                      backgroundColor: driverColor + "22",
                                      borderLeft: `4px solid ${driverColor}`,
                                    }}
                                  >
                                    <th className="text-left px-2 py-1 font-bold text-gray-500 w-14">
                                      Trip #
                                    </th>
                                    <th className="text-left px-2 py-1 font-bold text-gray-500 w-14">
                                      Time
                                    </th>
                                    <th className="text-left px-2 py-1 font-bold text-gray-500 w-28">
                                      Driver
                                    </th>
                                    <th className="text-left px-2 py-1 font-bold text-gray-500 w-36">
                                      Client
                                    </th>
                                    <th className="text-left px-2 py-1 font-bold text-gray-500 w-24">
                                      Phone
                                    </th>
                                    <th className="text-center px-2 py-1 font-bold text-gray-500 w-8">
                                      Pax
                                    </th>
                                    <th className="text-center px-2 py-1 font-bold text-gray-500 w-12">
                                      Bags
                                    </th>
                                    <th className="text-left px-2 py-1 font-bold text-gray-500">
                                      Destination
                                    </th>
                                    <th className="text-left px-2 py-1 font-bold text-gray-500 w-16">
                                      Vehicle
                                    </th>
                                    <th className="text-center px-2 py-1 font-bold text-gray-500 w-16">
                                      Driver ✓
                                    </th>
                                    <th className="text-center px-2 py-1 font-bold text-gray-500 w-16">
                                      Pax ✓
                                    </th>
                                    <th className="text-left px-2 py-1 font-bold text-gray-500 w-24">
                                      Return / Flight
                                    </th>
                                    <th className="text-left px-2 py-1 font-bold text-gray-500">
                                      Driver Notes
                                    </th>
                                    <th className="text-center px-2 py-1 font-bold text-gray-500 w-20 no-print">
                                      Message
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr
                                    style={{
                                      borderLeft: `4px solid ${driverColor}`,
                                    }}
                                  >
                                    <td className="px-2 py-1.5 font-bold text-blue-700 whitespace-nowrap">
                                      {trip.booking_number
                                        ? `#${trip.booking_number}`
                                        : `#${trip.id}`}
                                    </td>
                                    <td className="px-2 py-1.5 font-bold text-gray-900 whitespace-nowrap">
                                      {formatTime(trip.start_time)}
                                    </td>
                                    {/* Driver column */}
                                    <td className="px-2 py-1.5">
                                      <div className="flex items-center gap-1">
                                        <div
                                          className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                                          style={{
                                            backgroundColor: driverColor,
                                          }}
                                        >
                                          {driver ? driver.name.charAt(0) : "?"}
                                        </div>
                                        <span
                                          className="text-[10px] font-extrabold uppercase tracking-wide"
                                          style={{ color: driverColor }}
                                        >
                                          {driver ? driver.name : "UNASSIGNED"}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="px-2 py-1.5">
                                      <div className="font-extrabold text-[11px] text-gray-900 leading-tight">
                                        {trip.client_name || "—"}
                                      </div>
                                      {trip.num_people > 1 && (
                                        <div className="text-[9px] text-gray-400">
                                          {trip.num_people} passenger(s)
                                        </div>
                                      )}
                                    </td>
                                    <td className="px-2 py-1.5 text-gray-700 whitespace-nowrap">
                                      {trip.client_phone || "—"}
                                    </td>
                                    <td className="px-2 py-1.5 text-center font-semibold text-gray-700">
                                      {trip.num_people || "—"}
                                    </td>
                                    <td className="px-2 py-1.5 text-center text-gray-700 font-medium">
                                      {bagInfo || "—"}
                                    </td>
                                    <td className="px-2 py-1.5 text-gray-800 font-medium leading-tight">
                                      {trip.destination || "—"}
                                      {trip.outgoing_flight_info && (
                                        <div className="text-[9px] text-sky-600 font-medium">
                                          ✈↗ {trip.outgoing_flight_info}
                                        </div>
                                      )}
                                    </td>
                                    <td className="px-2 py-1.5 text-gray-600">
                                      {trip.vehicle_name || "—"}
                                    </td>
                                    {/* Driver Confirmed */}
                                    <td className="px-2 py-1.5 text-center">
                                      {trip.driver_accepted === "accepted" ? (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-green-100 text-green-800 border border-green-200">
                                          ✓ Yes
                                        </span>
                                      ) : trip.driver_accepted ===
                                        "declined" ? (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-100 text-red-800 border border-red-200">
                                          ✗ No
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                          Pending
                                        </span>
                                      )}
                                    </td>
                                    {/* Passenger Confirmed */}
                                    <td className="px-2 py-1.5 text-center">
                                      {trip.passenger_confirmed ===
                                      "confirmed" ? (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-green-100 text-green-800 border border-green-200">
                                          ✓ Yes
                                        </span>
                                      ) : trip.passenger_confirmed ===
                                        "cancelled" ? (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-100 text-red-800 border border-red-200">
                                          ✗ Cancelled
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                          Pending
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-2 py-1.5 text-gray-600 whitespace-nowrap leading-tight">
                                      {trip.return_date
                                        ? formatReturnDate(trip.return_date)
                                        : trip.returning_flight_info
                                          ? `✈↙ ${trip.returning_flight_info}`
                                          : "—"}
                                    </td>
                                    <td className="px-2 py-1.5 text-gray-600 leading-tight">
                                      {trip.driver_notes || ""}
                                    </td>
                                    {/* Message buttons - hidden on print */}
                                    <td className="px-2 py-1.5 no-print">
                                      <div className="flex items-center gap-1 justify-center">
                                        {trip.client_phone && (
                                          <button
                                            onClick={() =>
                                              setMessageModal({
                                                trip,
                                                recipientType: "passenger",
                                                driverName:
                                                  driver?.name || null,
                                                driverId: driver?.id || null,
                                                driverPhone:
                                                  driver?.phone || null,
                                                driverEmail:
                                                  driver?.email || null,
                                              })
                                            }
                                            className="px-1.5 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded text-[9px] font-semibold transition-colors border border-green-200 flex items-center gap-0.5"
                                            title={`Message ${trip.client_name}`}
                                          >
                                            <MessageSquare className="w-2.5 h-2.5" />
                                            Pax
                                          </button>
                                        )}
                                        {driver && driver.phone && (
                                          <button
                                            onClick={() =>
                                              setMessageModal({
                                                trip,
                                                recipientType: "driver",
                                                driverName: driver.name,
                                                driverId: driver.id,
                                                driverPhone: driver.phone,
                                                driverEmail: driver.email,
                                              })
                                            }
                                            className="px-1.5 py-1 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded text-[9px] font-semibold transition-colors border border-purple-200 flex items-center gap-0.5"
                                            title={`Message ${driver.name}`}
                                          >
                                            <MessageSquare className="w-2.5 h-2.5" />
                                            Driver
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          );
                        },
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Message Modal */}
      {messageModal && (
        <ReportMessageModal
          trip={messageModal.trip}
          recipientType={messageModal.recipientType}
          driverName={messageModal.driverName}
          driverId={messageModal.driverId}
          driverPhone={messageModal.driverPhone}
          driverEmail={messageModal.driverEmail}
          settings={settings}
          onClose={() => setMessageModal(null)}
        />
      )}
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * Quick Message Modal for the Print Schedule / 5 PM Report
 * Supports messaging either a driver or passenger with language hint
 * ──────────────────────────────────────────────────────────────────────────── */
function ReportMessageModal({
  trip,
  recipientType,
  driverName,
  driverId,
  driverPhone,
  driverEmail,
  settings,
  onClose,
}) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const isDriver = recipientType === "driver";
  const language = isDriver
    ? settings?.driver_language || "English"
    : settings?.passenger_language || "English";

  const recipientNameDisplay = isDriver
    ? driverName || "Driver"
    : trip.client_name || "Passenger";

  const recipientPhone = isDriver ? driverPhone : trip.client_phone;
  const recipientEmail = isDriver ? driverEmail : trip.client_email;

  const langEmoji =
    {
      English: "🇺🇸",
      Spanish: "🇪🇸",
      French: "🇫🇷",
      Portuguese: "🇧🇷",
      Chinese: "🇨🇳",
      Korean: "🇰🇷",
      Arabic: "🇸🇦",
      Russian: "🇷🇺",
      Hindi: "🇮🇳",
      Creole: "🇭🇹",
    }[language] || "🌐";

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error("Please enter a message");
      return;
    }

    setSending(true);
    try {
      if (isDriver && driverId) {
        const res = await fetch("/api/sms/driver-messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employee_id: driverId,
            message: message.trim(),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to send");
        toast.success(`Message sent to ${driverName} ✓`);
      } else {
        const res = await fetch("/api/sms/send-custom", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: trip.client_id,
            phone: trip.client_phone,
            email: trip.client_email,
            name: trip.client_name,
            message: message.trim(),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to send");

        const channels = [];
        if (data.results?.sms?.success !== false && data.results?.sms)
          channels.push("SMS");
        if (data.results?.email?.success) channels.push("Email");
        const channelText =
          channels.length > 0 ? ` via ${channels.join(" & ")}` : "";
        toast.success(`Message sent to ${trip.client_name}${channelText} ✓`);
      }
      onClose();
    } catch (err) {
      console.error("Send message error:", err);
      toast.error(err.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const tripTime = new Date(trip.start_time).toLocaleTimeString("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div
          className="p-5 text-white"
          style={{
            background: isDriver
              ? "linear-gradient(135deg, #7c3aed, #a855f7)"
              : "linear-gradient(135deg, #059669, #10b981)",
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <MessageSquare size={20} />
            </div>
            <div className="flex-1">
              <h2 className="font-bold text-lg">
                Message {isDriver ? "Driver" : "Passenger"}
              </h2>
              <p className="text-sm opacity-90">{recipientNameDisplay}</p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
          {/* Trip info badge */}
          <div className="mt-3 bg-white/15 rounded-lg px-3 py-2 text-sm">
            <span className="font-semibold">{trip.client_name}</span>
            <span className="mx-1.5 opacity-60">·</span>
            <span>{tripTime}</span>
            {trip.booking_number && (
              <>
                <span className="mx-1.5 opacity-60">·</span>
                <span>#{trip.booking_number}</span>
              </>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Language indicator */}
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
            <span className="text-lg">{langEmoji}</span>
            <div className="flex-1">
              <p className="text-xs font-semibold text-blue-800">
                {isDriver ? "Driver" : "Passenger"} Language: {language}
              </p>
              <p className="text-[11px] text-blue-600">
                Compose your message in {language}
              </p>
            </div>
            <a
              href="/settings"
              target="_blank"
              className="text-[10px] text-blue-500 hover:underline"
            >
              Change
            </a>
          </div>

          {/* Contact info */}
          <div className="bg-gray-50 rounded-lg px-3 py-2 space-y-1">
            {recipientPhone && (
              <p className="text-xs text-gray-600 flex items-center gap-1.5">
                <Phone size={11} /> {recipientPhone}
              </p>
            )}
            {recipientEmail && (
              <p className="text-xs text-gray-600 flex items-center gap-1.5">
                📧 {recipientEmail}
              </p>
            )}
            {!recipientPhone && !recipientEmail && (
              <p className="text-xs text-red-600 font-medium">
                ⚠️ No contact info available
              </p>
            )}
          </div>

          {/* Message input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={`Type your message in ${language}...`}
              rows={4}
              autoFocus
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <p className="text-[11px] text-gray-400">
              {message.length} characters
              {message.length > 160 &&
                " · May be split into multiple SMS segments"}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={sending}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={
              sending || !message.trim() || (!recipientPhone && !recipientEmail)
            }
            className={`px-5 py-2 text-sm font-bold text-white rounded-lg transition-all disabled:opacity-50 flex items-center gap-2 ${
              isDriver
                ? "bg-purple-600 hover:bg-purple-700"
                : "bg-green-600 hover:bg-green-700"
            }`}
          >
            <Send size={14} />
            {sending ? "Sending..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
