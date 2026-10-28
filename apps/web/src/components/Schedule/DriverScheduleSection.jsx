import React from "react";
import { CalendarX2 } from "lucide-react";
import { TripsTable } from "@/components/Trips/TripsTable";

export function DriverScheduleSection({
  driver,
  trips,
  blockedTimes,
  onTripClick,
  paidTripIds,
  onEdit,
  onDelete,
  onInvoice,
  onPay,
  onSendThankYou,
}) {
  const totalTrips = trips.length;
  const totalBlocked = blockedTimes.length;

  // Prefer onEdit over onTripClick for consistency
  const handleEdit = onEdit || onTripClick;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Driver Header */}
      <div
        className="px-6 py-4 border-b border-gray-200"
        style={{
          backgroundColor: driver.color + "10",
          borderColor: driver.color + "30",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-sm"
            style={{ backgroundColor: driver.color }}
          >
            {driver.name.charAt(0)}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {driver.name}
            </h2>
            <div className="flex items-center gap-3 text-sm text-gray-600 mt-0.5">
              <span>
                {totalTrips} {totalTrips === 1 ? "trip" : "trips"}
              </span>
              {totalBlocked > 0 && (
                <span className="flex items-center gap-1">
                  <CalendarX2 size={12} />
                  {totalBlocked} {totalBlocked === 1 ? "block" : "blocks"}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Blocked Times */}
      {blockedTimes.length > 0 && (
        <div className="divide-y divide-gray-100 border-b border-gray-200">
          {blockedTimes.map((block) => (
            <BlockedTimeItem key={`block-${block.id}`} block={block} />
          ))}
        </div>
      )}

      {/* Trips Table */}
      {totalTrips === 0 && totalBlocked === 0 ? (
        <div className="px-6 py-8 text-center text-gray-400">
          <p className="text-sm">No trips or blocked times scheduled</p>
        </div>
      ) : totalTrips > 0 ? (
        <div className="divide-y divide-gray-100">
          {trips.map((trip) => (
            <TripsTable
              key={trip.id}
              trips={[trip]}
              isLoading={false}
              error={null}
              onEdit={handleEdit}
              onDelete={onDelete || (() => {})}
              onInvoice={onInvoice || (() => {})}
              onPay={onPay || (() => {})}
              onSendThankYou={onSendThankYou}
              paidTripIds={paidTripIds}
              currentPage={1}
              pageSize={1}
              onPageChange={() => {}}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function BlockedTimeItem({ block }) {
  const startDate = new Date(block.start_time);
  const endDate = new Date(block.end_time);
  const now = new Date();
  const isActive = startDate <= now && endDate >= now;

  const startDateStr = startDate.toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
  });
  const endDateStr = endDate.toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
  });
  const sameDay = startDateStr === endDateStr;

  const startHourCDT = Number(
    startDate.toLocaleString("en-US", {
      timeZone: "America/Chicago",
      hour: "numeric",
      hour12: false,
    }),
  );
  const startMinCDT = Number(
    startDate.toLocaleString("en-US", {
      timeZone: "America/Chicago",
      minute: "numeric",
    }),
  );
  const endHourCDT = Number(
    endDate.toLocaleString("en-US", {
      timeZone: "America/Chicago",
      hour: "numeric",
      hour12: false,
    }),
  );
  const endMinCDT = Number(
    endDate.toLocaleString("en-US", {
      timeZone: "America/Chicago",
      minute: "numeric",
    }),
  );
  const isAllDay =
    startHourCDT === 0 &&
    startMinCDT === 0 &&
    endHourCDT === 23 &&
    endMinCDT === 59;

  const tzOpts = { timeZone: "America/Chicago" };
  const timeLabel = isAllDay
    ? "All Day"
    : sameDay
      ? `${startDate.toLocaleTimeString("en-US", { ...tzOpts, hour: "numeric", minute: "2-digit" })} – ${endDate.toLocaleTimeString("en-US", { ...tzOpts, hour: "numeric", minute: "2-digit" })}`
      : `${startDate.toLocaleTimeString("en-US", { ...tzOpts, hour: "numeric", minute: "2-digit" })} – ${endDate.toLocaleTimeString("en-US", { ...tzOpts, hour: "numeric", minute: "2-digit" })}`;

  return (
    <div
      className={`px-6 py-3 ${isActive ? "bg-red-50" : "bg-gray-50"} flex items-center gap-3`}
    >
      <CalendarX2
        size={16}
        className={isActive ? "text-red-600" : "text-gray-400"}
      />
      <span
        className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${isActive ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}
      >
        {isActive ? "Blocked Now" : "Blocked"}
      </span>
      <span className="text-sm font-medium text-gray-700">{timeLabel}</span>
      {block.reason && (
        <span className="text-sm text-gray-500 truncate">{block.reason}</span>
      )}
    </div>
  );
}
