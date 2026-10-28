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
import { BackfillCcFeeAmountSection } from "@/components/Settings/BackfillCcFeeAmountSection";
import { CleanDataSection } from "@/components/Settings/CleanDataSection";
import { BackfillZelleMetadataSection } from "@/components/Settings/BackfillZelleMetadataSection";
import { BackfillTipsSection } from "@/components/Settings/BackfillTipsSection";
import { FixCcFeeBalanceSection } from "@/components/Settings/FixCcFeeBalanceSection";
import { ChangeLogSection } from "@/components/Settings/ChangeLogSection";
import BackfillDispatcherSection from "@/components/Settings/BackfillDispatcherSection";

// Lazy-load all other Settings sub-components
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
const VehicleCategoriesSection = lazy(() =>
  import("@/components/Settings/VehicleCategoriesSection").then((m) => ({
    default: m.VehicleCategoriesSection || m.default,
  })),
);
const ExpenseCategoriesSection = lazy(() =>
  import("@/components/Settings/ExpenseCategoriesSection").then((m) => ({
    default: m.ExpenseCategoriesSection || m.default,
  })),
);
const SquareWebhookSection = lazy(() =>
  import("@/components/Settings/SquareWebhookSection").then((m) => ({
    default: m.SquareWebhookSection || m.default,
  })),
);
const ContactPhoneNumbersSection = lazy(() =>
  import("@/components/Settings/ContactPhoneNumbersSection").then((m) => ({
    default: m.ContactPhoneNumbersSection || m.default,
  })),
);
const MessageTemplatesSection = lazy(() =>
  import("@/components/Settings/MessageTemplatesSection").then((m) => ({
    default: m.MessageTemplatesSection || m.default,
  })),
);
const SettingsReportSection = lazy(() =>
  import("@/components/Settings/SettingsReportSection").then((m) => ({
    default: m.SettingsReportSection || m.default,
  })),
);
const NotSpecifiedPaymentsSection = lazy(() =>
  import("@/components/Settings/NotSpecifiedPaymentsSection").then((m) => ({
    default: m.NotSpecifiedPaymentsSection || m.default,
  })),
);
const FixAdminPaymentsSection = lazy(() =>
  import("@/components/Settings/FixAdminPaymentsSection").then((m) => ({
    default: m.FixAdminPaymentsSection || m.default,
  })),
);
const PassengerExportSection = lazy(() =>
  import("@/components/Settings/PassengerExportSection").then((m) => ({
    default: m.PassengerExportSection || m.default,
  })),
);
const BackfillCommissionsSection = lazy(() =>
  import("@/components/Settings/BackfillCommissionsSection").then((m) => ({
    default: m.BackfillCommissionsSection || m.default,
  })),
);
const FixPhoneNumbersSection = lazy(() =>
  import("@/components/Settings/FixPhoneNumbersSection").then((m) => ({
    default: m.FixPhoneNumbersSection || m.default,
  })),
);

function LazyFallback() {
  return (
    <div className="animate-pulse bg-gray-100 rounded-lg h-24 flex items-center justify-center text-sm text-gray-400">
      Loading…
    </div>
  );
}

function handlePrint(url) {
  const printWindow = window.open(url, "_blank");
  if (printWindow) {
    printWindow.addEventListener("load", () => {
      printWindow.print();
    });
  }
}

export default function SettingsDataPage() {
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

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === "#backup") {
      setActiveTab("data");
    }
  }, []);

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
      if (!response.ok) throw new Error("Failed to download");

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

  const handlePrint = (url) => {
    if (typeof window !== "undefined") {
      window.open(url, "_blank");
    }
  };

  return (
    <PageWithBackButton title="Settings & Data Management">
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
          className={`rounded-xl border-2 p-5 ${isFullyConfigured ? "bg-green-50 border-green-400" : "bg-red-50 border-red-400"}`}
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 text-2xl">
              {isFullyConfigured ? "✅" : "⚠️"}
            </div>
            <div className="flex-1 space-y-2">
              <h3
                className={`text-base font-bold ${isFullyConfigured ? "text-green-900" : "text-red-900"}`}
              >
                {isFullyConfigured
                  ? `SMS Configured: ${smsProvider}`
                  : "SMS Not Configured — Messages Will Fail"}
              </h3>
              <div
                className={`text-sm space-y-1 ${isFullyConfigured ? "text-green-800" : "text-red-800"}`}
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

        {/* Backup & Restore */}
        <Suspense fallback={<LazyFallback />}>
          <BackupRestoreSection />
        </Suspense>

        {/* Documentation Links */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">
            📚 Documentation & Guides
          </h3>
          <div className="grid md:grid-cols-4 gap-3">
            <div className="relative bg-white border border-blue-200 rounded-lg hover:shadow-md transition-shadow group">
              <a
                href="/docs/user-manual"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 pr-10"
              >
                <BookOpen size={24} className="text-blue-600 flex-shrink-0" />
                <div>
                  <div className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                    User Manual
                  </div>
                  <div className="text-xs text-gray-500">
                    Complete guide to using the system
                  </div>
                </div>
              </a>
              <button
                onClick={() => handlePrint("/docs/user-manual")}
                title="Print this guide"
                className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
              >
                <Printer size={14} />
              </button>
            </div>
            {/* Booking Form Guide - Now Download Only */}
            <div className="bg-white border border-indigo-200 rounded-lg hover:shadow-md transition-shadow">
              <button
                onClick={handleDownloadBookingGuide}
                className="flex items-center gap-3 p-4 w-full text-left hover:bg-indigo-50 rounded-lg transition-colors"
              >
                <Download size={24} className="text-indigo-600 flex-shrink-0" />
                <div>
                  <div className="font-semibold text-gray-900">
                    Booking Form Guide
                  </div>
                  <div className="text-xs text-gray-500">
                    Download step-by-step instructions (.docx)
                  </div>
                </div>
              </button>
            </div>
            {/* Square Guide */}
            <div className="relative bg-white border border-green-200 rounded-lg hover:shadow-md transition-shadow group">
              <a
                href="/docs/square-guide"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 pr-10"
              >
                <CreditCard
                  size={24}
                  className="text-green-600 flex-shrink-0"
                />
                <div>
                  <div className="font-semibold text-gray-900 group-hover:text-green-600 transition-colors">
                    Square Guide
                  </div>
                  <div className="text-xs text-gray-500">
                    Set up credit card payments
                  </div>
                </div>
              </a>
              <button
                onClick={() => handlePrint("/docs/square-guide")}
                title="Print this guide"
                className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
              >
                <Printer size={14} />
              </button>
            </div>
            <div className="relative bg-white border border-purple-200 rounded-lg hover:shadow-md transition-shadow group">
              <a
                href="/docs/venmo-guide"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 pr-10"
              >
                <Smartphone
                  size={24}
                  className="text-purple-600 flex-shrink-0"
                />
                <div>
                  <div className="font-semibold text-gray-900 group-hover:text-purple-600 transition-colors">
                    Venmo Guide
                  </div>
                  <div className="text-xs text-gray-500">
                    Accept mobile payments
                  </div>
                </div>
              </a>
              <button
                onClick={() => handlePrint("/docs/venmo-guide")}
                title="Print this guide"
                className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
              >
                <Printer size={14} />
              </button>
            </div>
          </div>
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
              <Suspense fallback={<LazyFallback />}>
                <SettingsReportSection />
              </Suspense>

              {/* Notification Toggles */}
              <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
                <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">
                  Notifications
                </h3>
                <p className="text-xs text-gray-400">
                  Turn off emails and/or texts while testing. Both are on by
                  default.
                </p>
                <div className="flex flex-col gap-3">
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
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings?.send_emails === "no" ? "bg-gray-300" : "bg-green-500"}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${settings?.send_emails === "no" ? "translate-x-1" : "translate-x-6"}`}
                      />
                    </button>
                  </div>
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
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings?.send_sms === "no" ? "bg-gray-300" : "bg-green-500"}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${settings?.send_sms === "no" ? "translate-x-1" : "translate-x-6"}`}
                      />
                    </button>
                  </div>
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
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings?.suppress_driver_confirmations === "yes" ? "bg-red-500" : "bg-gray-300"}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${settings?.suppress_driver_confirmations === "yes" ? "translate-x-6" : "translate-x-1"}`}
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
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings?.driver_portal_only === "yes" ? "bg-orange-500" : "bg-gray-300"}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${settings?.driver_portal_only === "yes" ? "translate-x-6" : "translate-x-1"}`}
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
                        const currentValue = settings?.require_login ?? "yes";
                        handleUpdate(
                          "require_login",
                          currentValue === "yes" ? "no" : "yes",
                        );
                      }}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${(settings?.require_login ?? "yes") === "yes" ? "bg-green-500" : "bg-gray-300"}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${(settings?.require_login ?? "yes") === "yes" ? "translate-x-6" : "translate-x-1"}`}
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

              {/* Language Preferences */}
              <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
                <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">
                  🌐 Language Preferences
                </h3>
                <p className="text-xs text-gray-400">
                  Set the default language for messages sent to drivers and
                  passengers.
                </p>
                <div className="grid md:grid-cols-2 gap-4">
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

              {/* Rate Per Mile */}
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
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings?.manual_mileage === "yes" ? "bg-orange-500" : "bg-gray-300"}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${settings?.manual_mileage === "yes" ? "translate-x-6" : "translate-x-1"}`}
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
              {/* ── Documentation & Guides ───────────────────────────── */}
              <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                <BookOpen size={16} className="text-blue-600" />
                <h3 className="text-base font-semibold text-gray-800">
                  Documentation & Guides
                </h3>
              </div>
              <div className="space-y-3">
                {/* Booking Form Guide - Download Word Doc */}
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-3">
                    <FileText size={18} className="text-blue-600" />
                    <div>
                      <div className="font-semibold text-gray-900">
                        Booking Form Guide
                      </div>
                      <div className="text-sm text-gray-600">
                        Step-by-step instructions for passengers (Word document)
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleDownloadBookingGuide}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Download size={16} />
                    Download .docx
                  </button>
                </div>

                {/* Dispatch Wizard Guide */}
                <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="flex items-center gap-3">
                    <BookOpen size={18} className="text-purple-600" />
                    <div>
                      <div className="font-semibold text-gray-900">
                        Dispatch Wizard Guide
                      </div>
                      <div className="text-sm text-gray-600">
                        Internal booking system instructions
                      </div>
                    </div>
                  </div>
                  <a
                    href="/docs/dispatch-wizard-guide"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    <ExternalLink size={16} />
                    View Guide
                  </a>
                </div>
              </div>

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

              {/* Square Payment Reconciliation — DEPRECATED */}
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
                    amount matches.
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

              {/* Payment Method Review — DEPRECATED */}
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

              {/* Admin-Fix Payment Revert — DEPRECATED */}
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

              {/* JSON Export — still active */}
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

              {/* JSON Import — DEPRECATED (Test Import / Live Import) */}
              <div className="relative opacity-50 pointer-events-none select-none">
                <div className="absolute top-1 right-1 z-10">
                  <span className="text-xs font-semibold text-gray-500 bg-gray-200 px-2 py-0.5 rounded border border-gray-300">
                    No Longer In Use
                  </span>
                </div>
                <Suspense fallback={<LazyFallback />}>
                  <JsonImportSection
                    importing={importing}
                    importResults={importResults}
                    setImportResults={setImportResults}
                    fileInputRef={fileInputRef}
                    handleImportFile={handleImportFile}
                  />
                </Suspense>
              </div>

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
                  compatible with Acuity Scheduling.
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

              {/* Passenger CSV Import — DEPRECATED */}
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

              {/* Client Home Addresses — DEPRECATED */}
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

              {/* Driver Commissions — DEPRECATED */}
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

              {/* Fix Phone Numbers — DEPRECATED */}
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

              {/* Credit Card Fee Cleanup — DEPRECATED */}
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

                {/* Backfill CC Fee Amount */}
                <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                  <CreditCard size={16} className="text-indigo-600" />
                  <h3 className="text-base font-semibold text-gray-800">
                    Backfill CC Fee Amount
                  </h3>
                  <span className="text-xs text-gray-400">
                    populate cc_fee_amount on existing trips
                  </span>
                </div>
                <BackfillCcFeeAmountSection />
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                <span className="text-base">💵</span>
                <h3 className="text-base font-semibold text-gray-800">
                  Fix Square Tip Display on Receipts
                </h3>
                <span className="text-xs text-gray-400">
                  recalculate tips_total for Square trips
                </span>
              </div>
              <BackfillTipsSection />

              {/* Fix CC Fee Balance */}
              <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                <span className="text-base">🔧</span>
                <h3 className="text-base font-semibold text-gray-800">
                  Fix CC Fee Balance
                </h3>
                <span className="text-xs text-gray-400">
                  correct trips where CC fees reduced balance_due
                </span>
              </div>
              <FixCcFeeBalanceSection />

              {/* Zelle Metadata Backfill */}
              <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                <CreditCard size={16} className="text-purple-600" />
                <h3 className="text-base font-semibold text-gray-800">
                  Backfill Zelle Contact Info
                </h3>
                <span className="text-xs text-gray-400">
                  add contact info to existing Zelle payments
                </span>
              </div>
              <BackfillZelleMetadataSection />

              {/* SMS Cleanup — DEPRECATED */}
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
