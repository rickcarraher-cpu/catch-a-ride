"use client";

import { ArrowLeft } from "lucide-react";

export function PageWithBackButton({
  backTo = "/dashboard",
  backLabel = "Back to Dashboard",
  companyName = "",
  children,
}) {
  return (
    <div className="space-y-6">
      {/* Company Name Header */}
      {companyName && (
        <div className="text-center pb-2 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            {companyName}
          </h1>
        </div>
      )}

      {/* Back Button */}
      <a
        href={backTo}
        className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors"
      >
        <ArrowLeft size={16} />
        {backLabel}
      </a>

      {children}
    </div>
  );
}
