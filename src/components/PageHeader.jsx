"use client";

import React from "react";
import { ArrowLeft } from "lucide-react";
import { getPageTitle } from "@/utils/routes";

/**
 * Dynamic Page Header Component
 * Automatically pulls the page title from the centralized routes configuration
 *
 * Usage:
 * <PageHeader />
 * or
 * <PageHeader subtitle="Track driver and passenger confirmations by 5 PM CST" />
 */
export default function PageHeader({
  subtitle,
  showBackButton = true,
  className = "",
}) {
  // Get current path from window.location (Vite app, not Next.js)
  const currentPath =
    typeof window !== "undefined" ? window.location.pathname : "/";
  const title = getPageTitle(currentPath);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Back to Dashboard */}
      {showBackButton && (
        <div>
          <a
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors"
          >
            <ArrowLeft size={16} />
            Back to Dashboard
          </a>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">
          {title}
        </h1>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>
    </div>
  );
}
