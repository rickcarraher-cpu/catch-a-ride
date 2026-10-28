"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import CalendarAtAGlance from "@/components/CalendarAtAGlance";
import { ArrowLeft } from "lucide-react";

export default function CalendarGlancePage() {
  const { data: allTrips = [] } = useQuery({
    queryKey: ["appointments-glance"],
    queryFn: async () => {
      const res = await fetch("/api/appointments");
      if (!res.ok) throw new Error("Failed to load trips");
      return res.json();
    },
    staleTime: 60_000,
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const res = await fetch("/api/employees");
      if (!res.ok) throw new Error("Failed to load drivers");
      return res.json();
    },
    staleTime: 60_000,
  });

  return (
    <div
      className="min-h-screen"
      style={{ background: "linear-gradient(to right, #fef9f0, #e8f4fd)" }}
    >
      <div className="max-w-4xl mx-auto px-6 py-6">
        {/* Back to Dashboard */}
        <a
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800 mb-5 no-underline"
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </a>

        <CalendarAtAGlance trips={allTrips} drivers={drivers} />
      </div>
    </div>
  );
}
