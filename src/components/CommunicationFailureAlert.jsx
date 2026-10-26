"use client";

import React, { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, Mail, MessageSquare, AlertTriangle } from "lucide-react";
import UnifiedAlertModal from "./UnifiedAlertModal";

const CHANNEL_ICONS = {
  email: Mail,
  sms: MessageSquare,
};

const RECIPIENT_LABELS = {
  passenger: "Passenger",
  driver: "Driver",
  office: "Office",
};

const EVENT_LABELS = {
  booking_created: "New Booking",
  booking_changed: "Booking Update",
  booking_cancelled: "Cancellation",
  booking_deleted: "Deletion",
  driver_assigned: "Driver Assignment",
};

export default function CommunicationFailureAlert() {
  const [dismissing, setDismissing] = useState(false);

  const { data, refetch } = useQuery({
    queryKey: ["communication-failures"],
    queryFn: async () => {
      const res = await fetch("/api/communication-failures");
      if (!res.ok) return { failures: [] };
      return res.json();
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const failures = data?.failures || [];
  const currentFailure = failures[0];
  const remainingCount = failures.length - 1;

  const acknowledge = useCallback(
    async (id) => {
      if (dismissing) return;
      setDismissing(true);
      try {
        await fetch("/api/communication-failures", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "acknowledge", id }),
        });
      } catch (err) {
        console.error("Failed to acknowledge failure:", err);
      }
      setDismissing(false);
      refetch();
    },
    [dismissing, refetch],
  );

  const acknowledgeAll = useCallback(async () => {
    if (dismissing) return;
    setDismissing(true);
    try {
      await fetch("/api/communication-failures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "acknowledge_all" }),
      });
    } catch (err) {
      console.error("Failed to acknowledge all failures:", err);
    }
    setDismissing(false);
    refetch();
  }, [dismissing, refetch]);

  if (!currentFailure) return null;

  const ChannelIcon = CHANNEL_ICONS[currentFailure.channel] || AlertTriangle;
  const channelLabel = currentFailure.channel === "email" ? "EMAIL" : "SMS";
  const recipientLabel =
    RECIPIENT_LABELS[currentFailure.recipient_type] ||
    currentFailure.recipient_type;
  const eventLabel =
    EVENT_LABELS[currentFailure.event_type] ||
    currentFailure.event_type ||
    "Communication";
  const timeAgo = getTimeAgo(currentFailure.created_at);

  const fields = [
    {
      isBig: true,
      value: `Trip #${currentFailure.booking_number || currentFailure.appointment_id || "N/A"}${currentFailure.passenger_name ? " · " + currentFailure.passenger_name : ""}`,
    },
    {
      isBadgeRow: true,
      badges: [
        {
          icon: ChannelIcon,
          label: channelLabel,
          bg:
            currentFailure.channel === "email"
              ? "rgba(59,130,246,0.2)"
              : "rgba(34,197,94,0.2)",
          color: currentFailure.channel === "email" ? "#93c5fd" : "#86efac",
          border:
            currentFailure.channel === "email"
              ? "rgba(59,130,246,0.3)"
              : "rgba(34,197,94,0.3)",
        },
        {
          label: recipientLabel,
          bg: "rgba(139,92,246,0.2)",
          color: "#c4b5fd",
          border: "rgba(139,92,246,0.3)",
        },
        {
          label: eventLabel,
          bg: "rgba(245,158,11,0.2)",
          color: "#fbbf24",
          border: "rgba(245,158,11,0.3)",
        },
      ],
    },
    currentFailure.recipient_address
      ? {
          label: "Destination",
          isMono: true,
          value: currentFailure.recipient_address,
        }
      : null,
    currentFailure.trip_date
      ? {
          label: "Trip Date",
          value: new Date(currentFailure.trip_date).toLocaleDateString(
            "en-US",
            {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            },
          ),
        }
      : null,
    currentFailure.driver_name
      ? { label: "Driver", value: currentFailure.driver_name }
      : null,
    {
      label: "Error",
      isError: true,
      value:
        currentFailure.error_message ||
        "Unknown error — the send failed without a specific error message.",
    },
  ].filter(Boolean);

  const actions = [
    {
      label: "Acknowledge",
      variant: "primary",
      icon: X,
      onClick: () => acknowledge(currentFailure.id),
      disabled: dismissing,
    },
    currentFailure.appointment_id
      ? {
          label: "View Trip",
          variant: "accent",
          href: `/trips?search=${currentFailure.booking_number || currentFailure.appointment_id}`,
        }
      : null,
    remainingCount > 0
      ? {
          label: "Clear All",
          variant: "secondary",
          onClick: acknowledgeAll,
          disabled: dismissing,
        }
      : null,
  ].filter(Boolean);

  return (
    <UnifiedAlertModal
      type="comm_failure"
      title="Communication Failed"
      subtitle={timeAgo}
      fields={fields}
      actions={actions}
      extraCount={remainingCount}
    />
  );
}

function getTimeAgo(dateStr) {
  if (!dateStr) return "";
  const now = new Date();
  const then = new Date(dateStr);
  const diffSec = Math.floor((now - then) / 1000);

  if (diffSec < 60) return "Just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return then.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
