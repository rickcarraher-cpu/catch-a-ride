"use client";

import React, { useState, useEffect, Suspense, lazy } from "react";
import { useSettings } from "@/hooks/useSettings";
import { useSmsTest } from "@/hooks/useSmsTest";
import { useEmailTest } from "@/hooks/useEmailTest";
import { useDataExport, useDataImport } from "@/hooks/useDataImportExport";
import {
  FileJson,
  Trash2,
  BookOpen,
  CreditCard,
  Smartphone,
  Printer,
  AlertTriangle,
  FileText,
  Calendar,
  Download,
  ExternalLink,
} from "lucide-react";
import { PageWithBackButton } from "@/components/PageWithBackButton";

// Direct imports for components that were failing with lazy loading
import { PassengerDefaultsSection } from "@/components/Settings/PassengerDefaultsSection";
import { DeduplicateSmsSection } from "@/components/Settings/DeduplicateSmsSection";
import { FixCreditCardFeesSection } from "@/components/Settings/FixCreditCardFeesSection";
import { CleanDataSection } from "@/components/Settings/CleanDataSection";
import { ChangeLogSection } from "@/components/Settings/ChangeLogSection";
import BackfillDispatcherSection from "@/components/Settings/BackfillDispatcherSection";

// Lazy-load all other Settings sub-components to reduce bundle size and build time
const BusinessInformationSection = lazy(() =>
  import("@/components/Settings/BusinessInformationSection").then((m) => ({
    default: m.BusinessInformationSection || m.default,
  })),
);
const BrandAssetsSection = lazy(() =>
  import("@/components/Settings/BrandAssetsSection").then((m) => ({
    default: m.BrandAssetsSection || m.default,
  })),
);
const CustomDomainSection = lazy(() =>
  import("@/components/Settings/CustomDomainSection").then((m) => ({
    default: m.CustomDomainSection || m.default,
  })),
);
const TestEmailSection = lazy(() =>
  import("@/components/Settings/TestEmailSection").then((m) => ({
    default: m.TestEmailSection || m.default,
  })),
);
const PaymentMethodsSection = lazy(() =>
  import("@/components/Settings/PaymentMethodsSection").then((m) => ({
    default: m.PaymentMethodsSection || m.default,
  })),
);
const BookingPageSection = lazy(() =>
  import("@/components/Settings/BookingPageSection").then((m) => ({
    default: m.BookingPageSection || m.default,
  })),
);
const FollowUpSection = lazy(() =>
  import("@/components/Settings/FollowUpSection").then((m) => ({
    default: m.FollowUpSection || m.default,
  })),
);
const SmsProviderSection = lazy(() =>
  import("@/components/Settings/SmsProviderSection").then((m) => ({
    default: m.SmsProviderSection || m.default,
  })),
);
const QuoCredentialsSection = lazy(() =>
  import("@/components/Settings/QuoCredentialsSection").then((m) => ({
    default: m.QuoCredentialsSection || m.default,
  })),
);
const TestSmsSection = lazy(() =>
  import("@/components/Settings/TestSmsSection").then((m) => ({
    default: m.TestSmsSection || m.default,
  })),
);
const ClickSendCredentialsSection = lazy(() =>
  import("@/components/Settings/ClickSendCredentialsSection").then((m) => ({
    default: m.ClickSendCredentialsSection || m.default,
  })),
);
const ClickSendWebhookSection = lazy(() =>
  import("@/components/Settings/ClickSendWebhookSection").then((m) => ({
    default: m.ClickSendWebhookSection || m.default,
  })),
);
const TestInboundSmsSection = lazy(() =>
  import("@/components/Settings/TestInboundSmsSection").then((m) => ({
    default: m.TestInboundSmsSection || m.default,
  })),
);
const SmsFormatTestSection = lazy(() =>
  import("@/components/Settings/SmsFormatTestSection").then((m) => ({
    default: m.SmsFormatTestSection || m.default,
  })),
);
const JsonExportSection = lazy(() =>
  import("@/components/Settings/JsonExportSection").then((m) => ({
    default: m.JsonExportSection || m.default,
  })),
);
const JsonImportSection = lazy(() =>
  import("@/components/Settings/JsonImportSection").then((m) => ({
    default: m.JsonImportSection || m.default,
  })),
);
const MigrateClientAddressesSection = lazy(() =>
  import("@/components/Settings/MigrateClientAddressesSection").then((m) => ({
    default: m.MigrateClientAddressesSection || m.default,
  })),
);
const PassengerCsvImportSection = lazy(() =>
  import("@/components/Settings/PassengerCsvImportSection").then((m) => ({
    default: m.PassengerCsvImportSection || m.default,
  })),
);
const BackupRestoreSection = lazy(() =>
  import("@/components/Settings/BackupRestoreSection").then((m) => ({
    default: m.BackupRestoreSection || m.default,
  })),
);
const PreferredLocationsSection = lazy(() =>
  import("@/components/Settings/PreferredLocationsSection").then((m) => ({
    default: m.PreferredLocationsSection || m.default,
  })),
);
const VehicleCategoriesSection = lazy(
  () => import("@/components/Settings/VehicleCategoriesSection"),
);
const ExpenseCategoriesSection = lazy(() =>
  import("@/components/Settings/ExpenseCategoriesSection").then((m) => ({
    default: m.ExpenseCategoriesSection || m.default,
  })),
);
const MessageTemplatesSection = lazy(() =>
  import("@/components/Settings/MessageTemplatesSection").then((m) => ({
    default: m.MessageTemplatesSection || m.default,
  })),
);
const BackfillCommissionsSection = lazy(() =>
  import("@/components/Settings/BackfillCommissionsSection").then((m) => ({
    default: m.BackfillCommissionsSection || m.default,
  })),
);
const SettingsReportSection = lazy(() =>
  import("@/components/Settings/SettingsReportSection").then((m) => ({
    default: m.SettingsReportSection || m.default,
  })),
);
const SquareWebhookSection = lazy(() =>
  import("@/components/Settings/SquareWebhookSection").then((m) => ({
    default: m.SquareWebhookSection || m.default,
  })),
);
const NotSpecifiedPaymentsSection = lazy(() =>
  import("@/components/Settings/NotSpecifiedPaymentsSection").then((m) => ({
    default: m.NotSpecifiedPaymentsSection || m.default,
  })),
);
const PassengerExportSection = lazy(() =>
  import("@/components/Settings/PassengerExportSection").then((m) => ({
    default: m.PassengerExportSection || m.default,
  })),
);
const FixPhoneNumbersSection = lazy(() =>
  import("@/components/Settings/FixPhoneNumbersSection").then((m) => ({
    default: m.FixPhoneNumbersSection || m.default,
  })),
);
const FixAdminPaymentsSection = lazy(() =>
  import("@/components/Settings/FixAdminPaymentsSection").then((m) => ({
    default: m.FixAdminPaymentsSection || m.default,
  })),
);
const ContactPhoneNumbersSection = lazy(() =>
  import("@/components/Settings/ContactPhoneNumbersSection").then((m) => ({
    default: m.ContactPhoneNumbersSection || m.default,
  })),
);

// Error Boundary to catch and display errors instead of blank page
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Settings page error:", error, errorInfo);
    this.state = { hasError: true, error, errorInfo };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-red-50 flex items-center justify-center p-8">
          <div className="bg-white border-2 border-red-300 rounded-lg p-8 max-w-2xl">
            <h1 className="text-2xl font-bold text-red-900 mb-4">
              Settings Page Error
            </h1>
            <p className="text-red-700 mb-4">
              Something went wrong while loading the Settings page.
            </p>
            <div className="bg-red-100 border border-red-200 rounded p-4 mb-4">
              <p className="text-sm font-mono text-red-800">
                {this.state.error?.toString()}
              </p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Lazy fallback component
const LazyFallback = () => (
  <div className="flex items-center gap-2 p-4 bg-gray-50 rounded-lg border border-gray-200">
    <div
      className="h-4 w-4 border-2 border-blue-600 border-r-transparent rounded-full"
      style={{ animation: "spin 1s linear infinite" }}
    />
    <span className="text-sm text-gray-500">Loading section...</span>
  </div>
);

// Helper to open a doc page and print it
function handlePrint(url) {
  if (typeof window === "undefined") return;
  const win = window.open(url, "_blank");
  if (win) {
    win.addEventListener("load", () => win.print());
  }
}

export default function SettingsPageWrapper() {
  return (
    <ErrorBoundary>
      <SettingsPage />
    </ErrorBoundary>
  );
}

function SettingsPage() {
  const [activeTab, setActiveTab] = useState("general");
  const { settings, isLoading, handleUpdate } = useSettings();
  const { testPhone, setTestPhone, sendingTest, handleSendTestSms } =
    useSmsTest();
  const { testEmail, setTestEmail, sendingTestEmail, handleSendTestEmail } =
    useEmailTest();
  const { exporting, handleExport } = useDataExport();
  const {
    importing,
    importResults,
    setImportResults,
    fileInputRef,
    handleImportFile,
  } = useDataImport();

  // Auto-open Data tab if #backup hash is present in URL
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === "#backup") {
      setActiveTab("data");
    }
  }, []);

  // Calculate SMS configuration status
  const smsProvider = settings?.sms_provider || "";
  const hasClickSendCredentials = !!(
    settings?.clicksend_username && settings?.clicksend_api_key
  );
  const hasQuoCredentials = !!(
    settings?.quo_api_key && settings?.quo_phone_number_id
  );

  const isFullyConfigured =
    (smsProvider === "ClickSend" && hasClickSendCredentials) ||
    (smsProvider === "Quo" && hasQuoCredentials);

  const handleDownloadBookingGuide = async () => {
    try {
      const response = await fetch("/api/docs/booking-guide-docx");
      if (!response.ok) throw new Error("Failed to download guide");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "CatchARide-Booking-Guide.doc";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Error downloading booking guide:", error);
      alert("Failed to download booking guide");
    }
  };

  return (
    <PageWithBackButton companyName={settings?.business_name || ""}>
      <div className="space-y-8">
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <div
              className="h-4 w-4 border-2 border-blue-600 border-r-transparent rounded-full"
              style={{ animation: "spin 1s linear infinite" }}
            />
            Loading settings...
          </div>
        )}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            Settings
          </h1>
          <p className="text-gray-500 mt-1">
            Configure your business details and app behavior.
          </p>
        </div>

        {/* SMS Configuration Status Banner */}
        <div
          className={`rounded-xl border-2 p-5 ${
            isFullyConfigured
              ? "bg-green-50 border-green-400"
              : "bg-red-50 border-red-400"
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 text-2xl">
              {isFullyConfigured ? "✅" : "⚠️"}
            </div>
            <div className="flex-1 space-y-2">
              <h3
                className={`text-base font-bold ${
                  isFullyConfigured ? "text-green-900" : "text-red-900"
                }`}
              >
                {isFullyConfigured
                  ? `SMS Configured: ${smsProvider}`
                  : "SMS Not Configured — Messages Will Fail"}
              </h3>

              {/* Current Status Details */}
              <div
                className={`text-sm space-y-1 ${
                  isFullyConfigured ? "text-green-800" : "text-red-800"
                }`}
              >
                {!smsProvider || smsProvider === "" ? (
                  <>
                    <p>
                      <strong>Problem:</strong> No SMS provider selected
                    </p>
                    <p>
                      <strong>Fix:</strong> Go to SMS tab → Select ClickSend or
                      Quo → Enter credentials → Click Save
                    </p>
                  </>
                ) : smsProvider === "ClickSend" ? (
                  hasClickSendCredentials ? (
                    <>
                      <p>
                        <strong>Provider:</strong> ClickSend
                      </p>
                      <p>
                        <strong>Username:</strong> {settings.clicksend_username}
                      </p>
                      <p>
                        <strong>API Key:</strong>{" "}
                        {settings.clicksend_api_key
                          ? "••••" + settings.clicksend_api_key.slice(-4)
                          : "Missing"}
                      </p>
                      <p className="text-green-700 font-semibold mt-2">
                        ✓ Ready to send SMS messages
                      </p>
                    </>
                  ) : (
                    <>
                      <p>
                        <strong>Provider:</strong> ClickSend (selected but
                        incomplete)
                      </p>
                      <p>
                        <strong>Username:</strong>{" "}
                        {settings.clicksend_username || "❌ Missing"}
                      </p>
                      <p>
                        <strong>API Key:</strong>{" "}
                        {settings.clicksend_api_key ? "✓ Set" : "❌ Missing"}
                      </p>
                      <p className="font-semibold mt-2">
                        ⚠️ Enter missing credentials in SMS tab and click Save
                      </p>
                    </>
                  )
                ) : smsProvider === "Quo" ? (
                  hasQuoCredentials ? (
                    <>
                      <p>
                        <strong>Provider:</strong> Quo
                      </p>
                      <p>
                        <strong>API Key:</strong>{" "}
                        {settings.quo_api_key
                          ? "••••" + settings.quo_api_key.slice(-4)
                          : "Missing"}
                      </p>
                      <p>
                        <strong>Phone Number ID:</strong>{" "}
                        {settings.quo_phone_number_id || "Missing"}
                      </p>
                      <p className="text-green-700 font-semibold mt-2">
                        ✓ Ready to send SMS messages
                      </p>
                    </>
                  ) : (
                    <>
                      <p>
                        <strong>Provider:</strong> Quo (selected but incomplete)
                      </p>
                      <p>
                        <strong>API Key:</strong>{" "}
                        {settings.quo_api_key ? "✓ Set" : "❌ Missing"}
                      </p>
                      <p>
                        <strong>Phone Number ID:</strong>{" "}
                        {settings.quo_phone_number_id || "❌ Missing"}
                      </p>
                      <p className="font-semibold mt-2">
                        ⚠️ Enter missing credentials in SMS tab and click Save
                      </p>
                    </>
                  )
                ) : (
                  <>
                    <p>
                      <strong>Provider:</strong> {smsProvider} (unknown)
                    </p>
                    <p className="font-semibold mt-2">
                      ⚠️ Invalid provider configuration
                    </p>
                  </>
                )}
              </div>

              {!isFullyConfigured && (
                <button
                  onClick={() => setActiveTab("sms")}
                  className="mt-3 px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors"
                >
                  Go to SMS Settings →
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Backup & Restore — pinned at top ────────────────────── */}
        <BackupRestoreSection />

        {/* ── Documentation & Guides ───────────────────────────── */}
        <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
          <BookOpen size={16} className="text-blue-600" />
          <h3 className="text-base font-semibold text-gray-800">
            Documentation & Guides
          </h3>
        </div>
        <div className="space-y-3">
          <button
            onClick={handleDownloadBookingGuide}
            className="w-full flex items-center justify-between p-4 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Download size={20} className="text-blue-600" />
              <div className="text-left">
                <div className="font-semibold text-gray-900">
                  Download Booking Form Guide
                </div>
                <div className="text-sm text-gray-600">
                  Step-by-step instructions for passengers (Word document)
                </div>
              </div>
            </div>
            <ExternalLink size={16} className="text-blue-600" />
          </button>

          <a
            href="/docs/dispatch-wizard-guide"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-between p-4 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200 transition-colors"
          >
            <div className="flex items-center gap-3">
              <BookOpen size={20} className="text-purple-600" />
              <div className="text-left">
                <div className="font-semibold text-gray-900">
                  Dispatch Wizard Guide
                </div>
                <div className="text-sm text-gray-600">
                  Internal guide for dispatchers and admins
                </div>
              </div>
            </div>
            <ExternalLink size={16} className="text-purple-600" />
          </a>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-8 border-b border-gray-200 -mb-[1px]">
          {["general", "booking", "messages", "sms", "data"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-medium transition-all relative ${
                activeTab === tab
                  ? "text-blue-600 border-b-2 border-blue-600 -mb-[1px]"
                  : "text-gray-500 hover:text-gray-900 border-b-2 border-transparent"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        <div className="max-w-3xl space-y-8">
          {activeTab === "general" && (
            <div className="space-y-6">
              {/* ── Settings Report Download ─────────────────────────── */}
              <Suspense fallback={<LazyFallback />}>
                <SettingsReportSection />
              </Suspense>

              {/* ── Notification Toggles ─────────────────────────────── */}
              <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
                <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">
                  Notifications
                </h3>
                <p className="text-xs text-gray-400">
                  Turn off emails and/or texts while testing. Both are on by
                  default.
                </p>
                <div className="flex flex-col gap-3">
                  {/* Send Emails toggle */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700">
                        Send Emails
                      </p>
                      <p className="text-xs text-gray-400">
                        Booking confirmations, updates & invoices
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdate(
                          "send_emails",
                          settings?.send_emails === "no" ? "yes" : "no",
                        )
                      }
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        settings?.send_emails === "no"
                          ? "bg-gray-300"
                          : "bg-green-500"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                          settings?.send_emails === "no"
                            ? "translate-x-1"
                            : "translate-x-6"
                        }`}
                      />
                    </button>
                  </div>
                  {/* Send Texts toggle */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700">
                        Send Texts
                      </p>
                      <p className="text-xs text-gray-400">
                        SMS notifications to owner & passengers
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdate(
                          "send_sms",
                          settings?.send_sms === "no" ? "yes" : "no",
                        )
                      }
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        settings?.send_sms === "no"
                          ? "bg-gray-300"
                          : "bg-green-500"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                          settings?.send_sms === "no"
                            ? "translate-x-1"
                            : "translate-x-6"
                        }`}
                      />
                    </button>
                  </div>
                  {/* NEW: Do Not Send Driver Confirmations toggle */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <div>
                      <p className="text-sm font-medium text-gray-700">
                        Do Not Send Driver Confirmations
                      </p>
                      <p className="text-xs text-gray-400">
                        Suppress all email and SMS confirmations to drivers only
                        (passengers still receive notifications)
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdate(
                          "suppress_driver_confirmations",
                          settings?.suppress_driver_confirmations === "yes"
                            ? "no"
                            : "yes",
                        )
                      }
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        settings?.suppress_driver_confirmations === "yes"
                          ? "bg-red-500"
                          : "bg-gray-300"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                          settings?.suppress_driver_confirmations === "yes"
                            ? "translate-x-6"
                            : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                  {settings?.suppress_driver_confirmations === "yes" && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <p className="text-xs text-red-800 font-medium">
                        🚫 Driver confirmations are OFF — drivers will NOT
                        receive any email or SMS notifications about trips.
                        Passengers will still receive confirmations normally.
                      </p>
                    </div>
                  )}
                  {/* Driver Portal Only Mode toggle */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <div>
                      <p className="text-sm font-medium text-gray-700">
                        Driver Portal Only Mode
                      </p>
                      <p className="text-xs text-gray-400">
                        Stop auto-confirmations to drivers — they must check
                        portal to accept/reject trips
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdate(
                          "driver_portal_only",
                          settings?.driver_portal_only === "yes" ? "no" : "yes",
                        )
                      }
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        settings?.driver_portal_only === "yes"
                          ? "bg-orange-500"
                          : "bg-gray-300"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                          settings?.driver_portal_only === "yes"
                            ? "translate-x-6"
                            : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                  {settings?.driver_portal_only === "yes" && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                      <p className="text-xs text-orange-800 font-medium">
                        🚫 Driver auto-confirmations are OFF — drivers must use
                        the portal to view their schedule. Direct messages from
                        admin still work.
                      </p>
                    </div>
                  )}
                  {/* Require Login toggle */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <div>
                      <p className="text-sm font-medium text-gray-700">
                        Require Login
                      </p>
                      <p className="text-xs text-gray-400">
                        Force login on opening page (recommended)
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        // Default to "yes" when undefined
                        const currentValue = settings?.require_login ?? "yes";
                        const newValue = currentValue === "yes" ? "no" : "yes";
                        handleUpdate("require_login", newValue);
                      }}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        (settings?.require_login ?? "yes") === "yes"
                          ? "bg-green-500"
                          : "bg-gray-300"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                          (settings?.require_login ?? "yes") === "yes"
                            ? "translate-x-6"
                            : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              <Suspense fallback={<LazyFallback />}>
                <BusinessInformationSection
                  settings={settings}
                  handleUpdate={handleUpdate}
                />
              </Suspense>

              <Suspense fallback={<LazyFallback />}>
                <ContactPhoneNumbersSection
                  settings={settings}
                  handleUpdate={handleUpdate}
                />
              </Suspense>

              {/* ── Language Preferences ──────────────────────── */}
              <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
                <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">
                  🌐 Language Preferences
                </h3>
                <p className="text-xs text-gray-400">
                  Set the default language for messages sent to drivers and
                  passengers. This helps the dispatcher know which language to
                  use when sending quick messages from the schedule builder.
                </p>
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Driver Language */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700">
                      Driver Language
                    </label>
                    <select
                      value={settings?.driver_language || "English"}
                      onChange={(e) =>
                        handleUpdate("driver_language", e.target.value)
                      }
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="English">🇺🇸 English</option>
                      <option value="Spanish">🇪🇸 Spanish</option>
                      <option value="French">🇫🇷 French</option>
                      <option value="Portuguese">🇧🇷 Portuguese</option>
                      <option value="Chinese">🇨🇳 Chinese</option>
                      <option value="Korean">🇰🇷 Korean</option>
                      <option value="Arabic">🇸🇦 Arabic</option>
                      <option value="Russian">🇷🇺 Russian</option>
                      <option value="Hindi">🇮🇳 Hindi</option>
                      <option value="Creole">🇭🇹 Creole</option>
                    </select>
                    <p className="text-[11px] text-gray-400">
                      Default language when messaging drivers
                    </p>
                  </div>
                  {/* Passenger Language */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700">
                      Passenger Language
                    </label>
                    <select
                      value={settings?.passenger_language || "English"}
                      onChange={(e) =>
                        handleUpdate("passenger_language", e.target.value)
                      }
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="English">🇺🇸 English</option>
                      <option value="Spanish">🇪🇸 Spanish</option>
                      <option value="French">🇫🇷 French</option>
                      <option value="Portuguese">🇧🇷 Portuguese</option>
                      <option value="Chinese">🇨🇳 Chinese</option>
                      <option value="Korean">🇰🇷 Korean</option>
                      <option value="Arabic">🇸🇦 Arabic</option>
                      <option value="Russian">🇷🇺 Russian</option>
                      <option value="Hindi">🇮🇳 Hindi</option>
                      <option value="Creole">🇭🇹 Creole</option>
                    </select>
                    <p className="text-[11px] text-gray-400">
                      Default language when messaging passengers
                    </p>
                  </div>
                </div>
              </div>

              <Suspense fallback={<LazyFallback />}>
                <CustomDomainSection
                  settings={settings}
                  handleUpdate={handleUpdate}
                />
              </Suspense>
              <Suspense fallback={<LazyFallback />}>
                <BrandAssetsSection
                  settings={settings}
                  handleUpdate={handleUpdate}
                />
              </Suspense>
              <Suspense fallback={<LazyFallback />}>
                <PreferredLocationsSection />
              </Suspense>
              <Suspense fallback={<LazyFallback />}>
                <VehicleCategoriesSection />
              </Suspense>
              <Suspense fallback={<LazyFallback />}>
                <ExpenseCategoriesSection />
              </Suspense>
              <Suspense fallback={<LazyFallback />}>
                <TestEmailSection
                  settings={settings}
                  testEmail={testEmail}
                  setTestEmail={setTestEmail}
                  sendingTestEmail={sendingTestEmail}
                  handleSendTestEmail={handleSendTestEmail}
                />
              </Suspense>
              <Suspense fallback={<LazyFallback />}>
                <PaymentMethodsSection
                  settings={settings}
                  handleUpdate={handleUpdate}
                />
              </Suspense>
              <Suspense fallback={<LazyFallback />}>
                <SquareWebhookSection />
              </Suspense>

              {/* ── Rate Per Mile ─────────────────────────────────── */}
              <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
                <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">
                  Pricing
                </h3>
                <p className="text-xs text-gray-400">
                  Used to auto-calculate trip cost from distance (Miles × Rate).
                </p>
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
                    Rate Per Mile
                  </label>
                  <div className="relative w-32">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                      $
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      defaultValue={settings?.rate_per_mile || ""}
                      key={settings?.rate_per_mile}
                      onBlur={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val))
                          handleUpdate("rate_per_mile", val.toFixed(2));
                      }}
                      className="w-full pl-7 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  {settings?.rate_per_mile && (
                    <span className="text-xs text-green-600 font-medium">
                      ${parseFloat(settings.rate_per_mile).toFixed(2)}/mile
                      saved
                    </span>
                  )}
                </div>

                {/* Manual Mileage Toggle */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      Enter Mileage Manually
                    </p>
                    <p className="text-xs text-gray-400">
                      When on, dispatch enters mileage by hand — system will not
                      auto-calculate distance
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      handleUpdate(
                        "manual_mileage",
                        settings?.manual_mileage === "yes" ? "no" : "yes",
                      )
                    }
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      settings?.manual_mileage === "yes"
                        ? "bg-orange-500"
                        : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        settings?.manual_mileage === "yes"
                          ? "translate-x-6"
                          : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
                {settings?.manual_mileage === "yes" && (
                  <p className="text-xs text-orange-600 font-medium bg-orange-50 border border-orange-200 rounded px-2 py-1">
                    ✏️ Manual mileage mode is ON — dispatch must enter miles for
                    each trip
                  </p>
                )}
              </div>
            </div>
          )}

          {activeTab === "booking" && (
            <div className="space-y-6">
              <Suspense fallback={<LazyFallback />}>
                <BookingPageSection
                  settings={settings}
                  handleUpdate={handleUpdate}
                />
              </Suspense>
              <Suspense fallback={<LazyFallback />}>
                <FollowUpSection
                  settings={settings}
                  handleUpdate={handleUpdate}
                />
              </Suspense>
            </div>
          )}

          {activeTab === "messages" && (
            <div className="space-y-6">
              <Suspense fallback={<LazyFallback />}>
                <MessageTemplatesSection
                  settings={settings}
                  handleUpdate={handleUpdate}
                />
              </Suspense>
            </div>
          )}

          {activeTab === "sms" && (
            <div className="space-y-6">
              <Suspense fallback={<LazyFallback />}>
                <SmsProviderSection
                  settings={settings}
                  handleUpdate={handleUpdate}
                />
              </Suspense>

              {settings?.sms_provider === "Quo" && (
                <>
                  <Suspense fallback={<LazyFallback />}>
                    <QuoCredentialsSection
                      settings={settings}
                      handleUpdate={handleUpdate}
                    />
                  </Suspense>
                  <Suspense fallback={<LazyFallback />}>
                    <TestSmsSection
                      settings={settings}
                      testPhone={testPhone}
                      setTestPhone={setTestPhone}
                      sendingTest={sendingTest}
                      handleSendTestSms={handleSendTestSms}
                      handleUpdate={handleUpdate}
                    />
                  </Suspense>
                  <Suspense fallback={<LazyFallback />}>
                    <SmsFormatTestSection />
                  </Suspense>
                </>
              )}

              {settings?.sms_provider === "ClickSend" && (
                <>
                  <Suspense fallback={<LazyFallback />}>
                    <ClickSendCredentialsSection
                      settings={settings}
                      handleUpdate={handleUpdate}
                    />
                  </Suspense>
                  <Suspense fallback={<LazyFallback />}>
                    <TestSmsSection
                      settings={settings}
                      testPhone={testPhone}
                      setTestPhone={setTestPhone}
                      sendingTest={sendingTest}
                      handleSendTestSms={handleSendTestSms}
                      handleUpdate={handleUpdate}
                    />
                  </Suspense>
                  <Suspense fallback={<LazyFallback />}>
                    <SmsFormatTestSection />
                  </Suspense>
                  <Suspense fallback={<LazyFallback />}>
                    <TestInboundSmsSection />
                  </Suspense>
                  <Suspense fallback={<LazyFallback />}>
                    <ClickSendWebhookSection />
                  </Suspense>
                </>
              )}
            </div>
          )}

          {activeTab === "data" && (
            <div className="space-y-6">
              {/* ── Change Log ───────────────────────────────────────── */}
              <div className="flex items-center gap-2">
                <span className="text-base">📋</span>
                <h3 className="text-base font-semibold text-gray-800">
                  Change Log
                </h3>
                <span className="text-xs text-gray-400">
                  recent trip & data changes
                </span>
              </div>
              <ChangeLogSection />

              {/* ── Backfill Dispatcher Names ─────────────────────────── */}
              <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                <span className="text-base">🧑‍💼</span>
                <h3 className="text-base font-semibold text-gray-800">
                  Dispatcher Names
                </h3>
                <span className="text-xs text-gray-400">
                  fill in dispatcher on existing admin-booked trips
                </span>
              </div>
              <BackfillDispatcherSection />

              {/* ── Payment Audit & Reconciliation — DEPRECATED ──────── */}
              <div className="relative opacity-50 pointer-events-none select-none">
                <div className="absolute top-1 right-1 z-10">
                  <span className="text-xs font-semibold text-gray-500 bg-gray-200 px-2 py-0.5 rounded border border-gray-300">
                    No Longer In Use
                  </span>
                </div>
                <div className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-300 rounded-lg p-6 space-y-3">
                  <div className="flex items-center gap-2">
                    <CreditCard size={20} className="text-green-600" />
                    <h3 className="text-base font-semibold text-gray-800">
                      Square Payment Reconciliation
                    </h3>
                    <span className="text-xs text-gray-400">
                      find & apply missed payments
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Scan your unpaid trips to check if Square payments were
                    actually received. Checks invoices, checkout links, and
                    amount matches. Automatically creates revenue, commission,
                    and CC fee transactions.
                  </p>
                  <div className="flex gap-3">
                    <a
                      href="/payment-audit"
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold text-sm"
                    >
                      <CreditCard size={16} />
                      Open Payment Audit
                    </a>
                    <div className="flex-1 bg-white border border-green-200 rounded-lg p-3">
                      <p className="text-xs text-green-800">
                        <strong>💡 Use this to fix:</strong> Trips marked "Link
                        Created" or "Unpaid" when customer actually paid in
                        Square
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Payment Method Not Specified — DEPRECATED ────────── */}
              <div className="relative opacity-50 pointer-events-none select-none">
                <div className="absolute top-1 right-1 z-10">
                  <span className="text-xs font-semibold text-gray-500 bg-gray-200 px-2 py-0.5 rounded border border-gray-300">
                    No Longer In Use
                  </span>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                  <AlertTriangle size={16} className="text-amber-600" />
                  <h3 className="text-base font-semibold text-gray-800">
                    Payment Method Review
                  </h3>
                  <span className="text-xs text-gray-400">
                    trips with unspecified payment method
                  </span>
                </div>
                <Suspense fallback={<LazyFallback />}>
                  <NotSpecifiedPaymentsSection />
                </Suspense>
              </div>

              {/* ── Revert Admin-Fix Payments — DEPRECATED ───────────── */}
              <div className="relative opacity-50 pointer-events-none select-none">
                <div className="absolute top-1 right-1 z-10">
                  <span className="text-xs font-semibold text-gray-500 bg-gray-200 px-2 py-0.5 rounded border border-gray-300">
                    No Longer In Use
                  </span>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                  <AlertTriangle size={16} className="text-orange-500" />
                  <h3 className="text-base font-semibold text-gray-800">
                    Admin-Fix Payment Revert
                  </h3>
                  <span className="text-xs text-gray-400">
                    remove accidental force-pay transactions
                  </span>
                </div>
                <Suspense fallback={<LazyFallback />}>
                  <FixAdminPaymentsSection />
                </Suspense>
              </div>

              {/* ── JSON Import/Export ──────────────────────────────── */}
              <div className="flex items-center gap-2">
                <FileJson size={16} className="text-blue-600" />
                <h3 className="text-base font-semibold text-gray-800">
                  JSON — Full Database
                </h3>
                <span className="text-xs text-gray-400">
                  all tables in one file
                </span>
              </div>

              <Suspense fallback={<LazyFallback />}>
                <JsonExportSection
                  exporting={exporting}
                  handleExport={handleExport}
                />
              </Suspense>
              <Suspense fallback={<LazyFallback />}>
                <JsonImportSection
                  importing={importing}
                  importResults={importResults}
                  setImportResults={setImportResults}
                  fileInputRef={fileInputRef}
                  handleImportFile={handleImportFile}
                />
              </Suspense>

              {/* ── Passenger Excel Export ──────────────────────────── */}
              <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                <h3 className="text-base font-semibold text-gray-800">
                  Passenger Export
                </h3>
                <span className="text-xs text-gray-400">
                  passengers with trips → Excel/CSV
                </span>
              </div>
              <Suspense fallback={<LazyFallback />}>
                <PassengerExportSection />
              </Suspense>

              {/* ── Acuity Export ────────────────────────────────────── */}
              <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                <FileText size={16} className="text-indigo-600" />
                <h3 className="text-base font-semibold text-gray-800">
                  Acuity Export
                </h3>
                <span className="text-xs text-gray-400">
                  export appointments, clients & drivers to Acuity CSV
                </span>
              </div>
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-indigo-300 rounded-lg p-6 space-y-3">
                <div className="flex items-center gap-2">
                  <Calendar size={20} className="text-indigo-600" />
                  <h3 className="text-base font-semibold text-gray-800">
                    Export to Acuity Scheduling
                  </h3>
                </div>
                <p className="text-sm text-gray-600">
                  Export your appointments, clients, and drivers in a format
                  compatible with Acuity Scheduling. Perfect for migrating your
                  business data or creating backups in a universal format.
                </p>
                <div className="flex gap-3">
                  <a
                    href="/acuity-export"
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-semibold text-sm"
                  >
                    <FileText size={16} />
                    Open Acuity Export
                  </a>
                  <div className="flex-1 bg-white border border-indigo-200 rounded-lg p-3">
                    <p className="text-xs text-indigo-800">
                      <strong>📋 Exports:</strong> Appointments with all
                      details, return trips, tour info, clients/passengers, and
                      drivers/calendars
                    </p>
                  </div>
                </div>
              </div>

              {/* ── Passenger CSV Import — DEPRECATED ──────────────── */}
              <div className="relative opacity-50 pointer-events-none select-none">
                <div className="absolute top-1 right-1 z-10">
                  <span className="text-xs font-semibold text-gray-500 bg-gray-200 px-2 py-0.5 rounded border border-gray-300">
                    No Longer In Use
                  </span>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                  <h3 className="text-base font-semibold text-gray-800">
                    Passenger CSV Import
                  </h3>
                  <span className="text-xs text-gray-400">
                    add or update passengers
                  </span>
                </div>
                <Suspense fallback={<LazyFallback />}>
                  <PassengerCsvImportSection />
                </Suspense>
              </div>

              {/* ── Migrate Client Addresses — DEPRECATED ────────────── */}
              <div className="relative opacity-50 pointer-events-none select-none">
                <div className="absolute top-1 right-1 z-10">
                  <span className="text-xs font-semibold text-gray-500 bg-gray-200 px-2 py-0.5 rounded border border-gray-300">
                    No Longer In Use
                  </span>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                  <h3 className="text-base font-semibold text-gray-800">
                    Client Home Addresses
                  </h3>
                  <span className="text-xs text-gray-400">
                    one-time migration
                  </span>
                </div>
                <Suspense fallback={<LazyFallback />}>
                  <MigrateClientAddressesSection />
                </Suspense>
              </div>

              {/* ── Fix Missing Commissions — DEPRECATED ─────────────── */}
              <div className="relative opacity-50 pointer-events-none select-none">
                <div className="absolute top-1 right-1 z-10">
                  <span className="text-xs font-semibold text-gray-500 bg-gray-200 px-2 py-0.5 rounded border border-gray-300">
                    No Longer In Use
                  </span>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                  <h3 className="text-base font-semibold text-gray-800">
                    Driver Commissions
                  </h3>
                  <span className="text-xs text-gray-400">
                    fix missing commissions on paid trips
                  </span>
                </div>
                <Suspense fallback={<LazyFallback />}>
                  <BackfillCommissionsSection />
                </Suspense>
              </div>

              {/* ── Fix Phone Numbers — DEPRECATED ───────────────────── */}
              <div className="relative opacity-50 pointer-events-none select-none">
                <div className="absolute top-1 right-1 z-10">
                  <span className="text-xs font-semibold text-gray-500 bg-gray-200 px-2 py-0.5 rounded border border-gray-300">
                    No Longer In Use
                  </span>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                  <h3 className="text-base font-semibold text-gray-800">
                    Fix Phone Numbers
                  </h3>
                  <span className="text-xs text-gray-400">
                    normalize passenger phones to E.164 format
                  </span>
                </div>
                <Suspense fallback={<LazyFallback />}>
                  <FixPhoneNumbersSection />
                </Suspense>
              </div>

              {/* ── Fix Credit Card Fee Trips — DEPRECATED ───────────── */}
              <div className="relative opacity-50 pointer-events-none select-none">
                <div className="absolute top-1 right-1 z-10">
                  <span className="text-xs font-semibold text-gray-500 bg-gray-200 px-2 py-0.5 rounded border border-gray-300">
                    No Longer In Use
                  </span>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                  <CreditCard size={16} className="text-blue-600" />
                  <h3 className="text-base font-semibold text-gray-800">
                    Credit Card Fee Cleanup
                  </h3>
                  <span className="text-xs text-gray-400">
                    fix trips where only CC fee is owed
                  </span>
                </div>
                <FixCreditCardFeesSection />
              </div>

              {/* ── Remove Duplicate SMS — DEPRECATED ────────────────── */}
              <div className="relative opacity-50 pointer-events-none select-none">
                <div className="absolute top-1 right-1 z-10">
                  <span className="text-xs font-semibold text-gray-500 bg-gray-200 px-2 py-0.5 rounded border border-gray-300">
                    No Longer In Use
                  </span>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                  <h3 className="text-base font-semibold text-gray-800">
                    SMS Cleanup
                  </h3>
                  <span className="text-xs text-gray-400">
                    remove duplicate messages
                  </span>
                </div>
                <DeduplicateSmsSection />
              </div>

              {/* ── Clean Data ───────────────────────────────────────── */}
              <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                <Trash2 size={16} className="text-red-600" />
                <h3 className="text-base font-semibold text-gray-800">
                  Clean Data
                </h3>
                <span className="text-xs text-gray-400">
                  delete all data permanently
                </span>
              </div>
              <CleanDataSection />
            </div>
          )}
        </div>
      </div>
    </PageWithBackButton>
  );
}
