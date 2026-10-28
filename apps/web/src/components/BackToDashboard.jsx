"use client";

import React from "react";
import { ArrowLeft } from "lucide-react";

export default function BackToDashboard() {
  return (
    <div className="mb-6">
      <a
        href="/dashboard"
        className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
      >
        <ArrowLeft size={18} />
        Back to Dashboard
      </a>
    </div>
  );
}
