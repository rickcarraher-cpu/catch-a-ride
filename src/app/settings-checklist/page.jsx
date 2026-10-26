"use client";

import React, { useState } from "react";
import { PageWithBackButton } from "@/components/PageWithBackButton";
import { Download, FileText } from "lucide-react";
import { useSettings } from "@/hooks/useSettings";

const SETTINGS_CHECKLIST = [
  {
    category: "🏢 Business Information",
    description: "Core business details and branding",
    settings: [
      { key: "business_name", label: "Business Name", required: true },
      {
        key: "provider_label",
        label: "Provider Label (e.g., Driver)",
        required: false,
      },
      { key: "business_phone", label: "Business Phone", required: true },
      { key: "owner_email", label: "Owner Email", required: true },
      {
        key: "additional_owner_emails",
        label: "Additional Owner Emails",
        required: false,
      },
      {
        key: "business_hours_start",
        label: "Business Hours - Opening Time",
        required: true,
      },
      {
        key: "business_hours_end",
        label: "Business Hours - Closing Time",
        required: true,
      },
      { key: "from_name", label: "Email From Name", required: true },
      {
        key: "from_email",
        label: "Email From Address (Resend)",
        required: true,
      },
      { key: "business_address", label: "Business Address", required: false },
      {
        key: "bypass_dashboard_login",
        label: "Bypass Dashboard Login",
        required: false,
        type: "toggle",
      },
      {
        key: "bypass_driver_login",
        label: "Bypass Driver Login",
        required: false,
        type: "toggle",
      },
    ],
  },
  {
    category: "🎨 Brand Assets",
    description: "Logo and visual branding",
    settings: [
      { key: "logo_url", label: "Business Logo URL", required: false },
    ],
  },
  {
    category: "🌐 Custom Domain",
    description: "Custom domain configuration",
    settings: [
      { key: "custom_domain", label: "Custom Domain", required: false },
    ],
  },
  {
    category: "📞 Contact Phone Numbers",
    description: "Phone numbers displayed in confirmations",
    settings: [
      {
        key: "Non Reservation Number ID",
        label: "Non-Reservation Number (non-urgent)",
        required: false,
      },
      {
        key: "Reservation Number ID",
        label: "Reservation Number (urgent)",
        required: false,
      },
    ],
  },
  {
    category: "💳 Payment Settings",
    description: "Payment methods and processing fees",
    settings: [
      {
        key: "prepay_enabled",
        label: "Require Prepayment",
        required: false,
        type: "toggle",
      },
      {
        key: "tipping_enabled",
        label: "Enable Tipping",
        required: false,
        type: "toggle",
      },
      {
        key: "credit_card_fee_percent",
        label: "Credit Card Fee Percentage",
        required: true,
      },
      {
        key: "payment_cash_enabled",
        label: "Accept Cash",
        required: false,
        type: "toggle",
      },
      {
        key: "payment_square_invoice_enabled",
        label: "Accept Square Invoice",
        required: false,
        type: "toggle",
      },
      {
        key: "payment_venmo_enabled",
        label: "Accept Venmo",
        required: false,
        type: "toggle",
      },
      {
        key: "venmo_handle",
        label: "Venmo Handle",
        required: false,
        dependsOn: "payment_venmo_enabled",
      },
      {
        key: "payment_zelle_enabled",
        label: "Accept Zelle",
        required: false,
        type: "toggle",
      },
      {
        key: "zelle_contact",
        label: "Zelle Email or Phone",
        required: false,
        dependsOn: "payment_zelle_enabled",
      },
      {
        key: "payment_square_enabled",
        label: "Accept Square",
        required: false,
        type: "toggle",
      },
      {
        key: "square_environment",
        label: "Square Environment",
        required: false,
        dependsOn: "payment_square_enabled",
      },
      {
        key: "square_access_token",
        label: "Square Access Token",
        required: false,
        dependsOn: "payment_square_enabled",
        sensitive: true,
      },
      {
        key: "square_application_id",
        label: "Square Application ID",
        required: false,
        dependsOn: "payment_square_enabled",
      },
      {
        key: "square_location_id",
        label: "Square Location ID",
        required: false,
        dependsOn: "payment_square_enabled",
      },
      {
        key: "square_webhook_signature",
        label: "Square Webhook Signature",
        required: false,
        dependsOn: "payment_square_enabled",
        sensitive: true,
      },
      {
        key: "payment_stripe_enabled",
        label: "Accept Stripe",
        required: false,
        type: "toggle",
      },
    ],
  },
  {
    category: "📝 Booking Page Settings",
    description: "Public booking page configuration",
    settings: [
      {
        key: "booking_page_title",
        label: "Booking Page Title",
        required: false,
      },
      {
        key: "booking_page_subtitle",
        label: "Booking Page Subtitle",
        required: false,
      },
      {
        key: "booking_message",
        label: "Booking Page Welcome Message",
        required: false,
      },
      {
        key: "require_welcome_screen",
        label: "Show Welcome Screen",
        required: false,
        type: "toggle",
      },
      {
        key: "enable_tour_booking",
        label: "Enable Tour Booking",
        required: false,
        type: "toggle",
      },
      {
        key: "tour_authorized_emails",
        label: "Tour Authorized Emails",
        required: false,
        dependsOn: "enable_tour_booking",
      },
    ],
  },
  {
    category: "❤️ Follow-Up Settings",
    description: "Thank you messages and review requests",
    settings: [
      {
        key: "followup_enabled",
        label: "Enable Follow-Up Messages",
        required: false,
        type: "toggle",
      },
      {
        key: "google_review_link",
        label: "Google Review Link",
        required: false,
        dependsOn: "followup_enabled",
      },
      {
        key: "followup_message",
        label: "Thank You Message",
        required: false,
        dependsOn: "followup_enabled",
      },
    ],
  },
  {
    category: "📱 SMS Provider",
    description: "SMS service configuration",
    settings: [
      {
        key: "sms_provider",
        label: "SMS Provider (Quo, ClickSend, or None)",
        required: true,
      },
      {
        key: "sms_auto_delete_on_complete",
        label: "Auto-delete SMS on Trip Complete",
        required: false,
        type: "toggle",
      },
    ],
  },
  {
    category: "📲 Quo (OpenPhone) Settings",
    description: "Quo/OpenPhone SMS credentials",
    settings: [
      {
        key: "quo_api_key",
        label: "Quo API Key",
        required: false,
        dependsOn: "sms_provider:Quo",
        sensitive: true,
      },
      {
        key: "quo_phone_number_id",
        label: "Quo Phone Number ID",
        required: false,
        dependsOn: "sms_provider:Quo",
      },
    ],
  },
  {
    category: "📨 ClickSend Settings",
    description: "ClickSend SMS credentials and webhook",
    settings: [
      {
        key: "clicksend_username",
        label: "ClickSend Username",
        required: false,
        dependsOn: "sms_provider:ClickSend",
      },
      {
        key: "clicksend_api_key",
        label: "ClickSend API Key",
        required: false,
        dependsOn: "sms_provider:ClickSend",
        sensitive: true,
      },
      {
        key: "clicksend_webhook_secret",
        label: "ClickSend Webhook Secret",
        required: false,
        dependsOn: "sms_provider:ClickSend",
        sensitive: true,
      },
    ],
  },
  {
    category: "✉️ Message Templates",
    description: "Customize email and SMS message templates",
    settings: [
      {
        key: "template_booking_created_sms",
        label: "Booking Created - SMS",
        required: false,
      },
      {
        key: "template_booking_created_email_subject",
        label: "Booking Created - Email Subject",
        required: false,
      },
      {
        key: "template_booking_created_email_body",
        label: "Booking Created - Email Body",
        required: false,
      },
      {
        key: "template_booking_changed_sms",
        label: "Booking Changed - SMS",
        required: false,
      },
      {
        key: "template_booking_changed_email_subject",
        label: "Booking Changed - Email Subject",
        required: false,
      },
      {
        key: "template_booking_changed_email_body",
        label: "Booking Changed - Email Body",
        required: false,
      },
      {
        key: "template_booking_deleted_sms",
        label: "Booking Cancelled - SMS",
        required: false,
      },
      {
        key: "template_booking_deleted_email_subject",
        label: "Booking Cancelled - Email Subject",
        required: false,
      },
      {
        key: "template_booking_deleted_email_body",
        label: "Booking Cancelled - Email Body",
        required: false,
      },
      {
        key: "template_reminder_day_before_sms",
        label: "Day-Before Reminder - SMS",
        required: false,
      },
      {
        key: "template_reminder_day_before_email_subject",
        label: "Day-Before Reminder - Email Subject",
        required: false,
      },
      {
        key: "template_reminder_day_before_email_body",
        label: "Day-Before Reminder - Email Body",
        required: false,
      },
      {
        key: "template_driver_assigned_sms",
        label: "Driver Assigned - SMS",
        required: false,
      },
      {
        key: "template_driver_assigned_email_subject",
        label: "Driver Assigned - Email Subject",
        required: false,
      },
      {
        key: "template_driver_assigned_email_body",
        label: "Driver Assigned - Email Body",
        required: false,
      },
      {
        key: "template_payment_confirmed_sms",
        label: "Payment Confirmed - SMS",
        required: false,
      },
      {
        key: "template_payment_confirmed_email_subject",
        label: "Payment Confirmed - Email Subject",
        required: false,
      },
      {
        key: "template_payment_confirmed_email_body",
        label: "Payment Confirmed - Email Body",
        required: false,
      },
      {
        key: "template_refund_processed_sms",
        label: "Refund Processed - SMS",
        required: false,
      },
      {
        key: "template_refund_processed_email_subject",
        label: "Refund Processed - Email Subject",
        required: false,
      },
      {
        key: "template_refund_processed_email_body",
        label: "Refund Processed - Email Body",
        required: false,
      },
      {
        key: "template_followup_sms",
        label: "Thank You Follow-Up - SMS",
        required: false,
      },
      {
        key: "template_followup_email_subject",
        label: "Thank You Follow-Up - Email Subject",
        required: false,
      },
      {
        key: "template_followup_email_body",
        label: "Thank You Follow-Up - Email Body",
        required: false,
      },
    ],
  },
  {
    category: "👥 Passenger Defaults",
    description: "Default location settings for new passengers",
    settings: [
      {
        key: "default_passenger_locations",
        label: "Default Passenger Locations (JSON)",
        required: false,
      },
    ],
  },
  {
    category: "🚗 Pricing & Distance",
    description: "Rate and distance calculation settings",
    settings: [
      { key: "rate_per_mile", label: "Rate Per Mile", required: false },
      {
        key: "distance_method",
        label: "Distance Calculation Method",
        required: false,
      },
    ],
  },
];

export default function SettingsChecklistPage() {
  const { settings, loading } = useSettings();
  const [generating, setGenerating] = useState(false);

  const isSettingApplicable = (setting) => {
    if (!setting.dependsOn) return true;

    const [dependencyKey, dependencyValue] = setting.dependsOn.includes(":")
      ? setting.dependsOn.split(":")
      : [setting.dependsOn, null];

    const dependencyMet = dependencyValue
      ? settings?.[dependencyKey] === dependencyValue
      : settings?.[dependencyKey] === "true" ||
        settings?.[dependencyKey] === "yes";

    return dependencyMet;
  };

  const getSettingValue = (setting) => {
    if (!settings) return "";
    const value = settings[setting.key];

    if (!value || value.trim() === "") return "";

    // Mask sensitive values
    if (setting.sensitive) {
      return "••••••••••••";
    }

    // Format toggle values
    if (setting.type === "toggle") {
      if (value === "true" || value === "yes") return "✓ Enabled";
      if (value === "false" || value === "no") return "✗ Disabled";
      return value;
    }

    return value;
  };

  const generateWordDocument = () => {
    setGenerating(true);

    try {
      // Build HTML content for Word document
      let htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Settings Checklist - ${settings?.business_name || "Limo Service"}</title>
          <style>
            body {
              font-family: 'Calibri', 'Arial', sans-serif;
              font-size: 11pt;
              line-height: 1.5;
              margin: 1in;
              color: #000;
            }
            h1 {
              font-size: 24pt;
              font-weight: bold;
              color: #1f2937;
              margin-bottom: 0.5em;
              border-bottom: 3px solid #2563eb;
              padding-bottom: 0.3em;
            }
            h2 {
              font-size: 16pt;
              font-weight: bold;
              color: #1f2937;
              margin-top: 1.5em;
              margin-bottom: 0.5em;
              background-color: #eff6ff;
              padding: 0.5em;
              border-left: 4px solid #2563eb;
            }
            .category-description {
              font-size: 10pt;
              color: #6b7280;
              font-style: italic;
              margin-bottom: 1em;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 2em;
              page-break-inside: avoid;
            }
            th {
              background-color: #f3f4f6;
              font-weight: bold;
              text-align: left;
              padding: 0.5em;
              border: 1px solid #d1d5db;
              font-size: 10pt;
            }
            td {
              padding: 0.5em;
              border: 1px solid #d1d5db;
              vertical-align: top;
              font-size: 10pt;
            }
            .setting-label {
              font-weight: 600;
              color: #374151;
            }
            .required-badge {
              background-color: #fee2e2;
              color: #991b1b;
              padding: 0.1em 0.4em;
              border-radius: 3px;
              font-size: 8pt;
              font-weight: bold;
              margin-left: 0.3em;
            }
            .conditional-badge {
              background-color: #dbeafe;
              color: #1e40af;
              padding: 0.1em 0.4em;
              border-radius: 3px;
              font-size: 8pt;
              font-weight: bold;
              margin-left: 0.3em;
            }
            .value-configured {
              color: #059669;
              font-weight: 500;
            }
            .value-not-set {
              color: #9ca3af;
              font-style: italic;
            }
            .value-sensitive {
              color: #6b7280;
              font-family: monospace;
            }
            .header-info {
              margin-bottom: 2em;
              padding: 1em;
              background-color: #f9fafb;
              border: 1px solid #e5e7eb;
            }
            .header-info p {
              margin: 0.3em 0;
              font-size: 10pt;
            }
            .footer {
              margin-top: 3em;
              padding-top: 1em;
              border-top: 1px solid #d1d5db;
              font-size: 9pt;
              color: #6b7280;
              text-align: center;
            }
            @media print {
              body { margin: 0.5in; }
              h2 { page-break-after: avoid; }
              table { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <h1>Settings Configuration Checklist</h1>
          <div class="header-info">
            <p><strong>Business:</strong> ${settings?.business_name || "Not Set"}</p>
            <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
            <p><strong>Purpose:</strong> Complete inventory of all system settings with current values</p>
          </div>
      `;

      // Add each category
      SETTINGS_CHECKLIST.forEach((category) => {
        htmlContent += `
          <h2>${category.category}</h2>
          <p class="category-description">${category.description}</p>
        `;

        if (category.settings && category.settings.length > 0) {
          htmlContent += `
            <table>
              <thead>
                <tr>
                  <th style="width: 35%;">Setting</th>
                  <th style="width: 15%;">Status</th>
                  <th style="width: 50%;">Current Value</th>
                </tr>
              </thead>
              <tbody>
          `;

          category.settings.forEach((setting) => {
            const isApplicable = isSettingApplicable(setting);
            if (!isApplicable) return; // Skip non-applicable settings

            const value = getSettingValue(setting);
            const hasValue = value && value.trim() !== "";

            htmlContent += `
              <tr>
                <td class="setting-label">
                  ${setting.label}
                  ${setting.required ? '<span class="required-badge">REQUIRED</span>' : ""}
                  ${setting.dependsOn ? '<span class="conditional-badge">CONDITIONAL</span>' : ""}
                </td>
                <td>
                  ${hasValue ? '<span class="value-configured">✓ Configured</span>' : '<span class="value-not-set">Not Set</span>'}
                </td>
                <td>
                  ${
                    hasValue
                      ? setting.sensitive
                        ? `<span class="value-sensitive">${value}</span>`
                        : `<span class="value-configured">${value.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</span>`
                      : '<span class="value-not-set">—</span>'
                  }
                </td>
              </tr>
            `;
          });

          htmlContent += `
              </tbody>
            </table>
          `;
        } else {
          htmlContent += `
            <p class="category-description" style="margin-left: 1em;">
              <em>This category is managed through a separate interface in the Settings page.</em>
            </p>
          `;
        }
      });

      htmlContent += `
          <div class="footer">
            <p>This document was automatically generated from your system settings.</p>
            <p>Sensitive values (API keys, tokens) are masked for security.</p>
          </div>
        </body>
        </html>
      `;

      // Create blob and download
      const blob = new Blob([htmlContent], { type: "application/msword" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Settings_Checklist_${settings?.business_name?.replace(/\s+/g, "_") || "Export"}_${new Date().toISOString().split("T")[0]}.doc`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setGenerating(false);
    } catch (error) {
      console.error("Error generating document:", error);
      alert("Failed to generate document. Please try again.");
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <PageWithBackButton backTo="/settings" title="Settings Checklist">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-500">Loading settings...</p>
          </div>
        </div>
      </PageWithBackButton>
    );
  }

  return (
    <PageWithBackButton backTo="/settings" title="Settings Checklist">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header with Export Button */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold">
                Settings Configuration Checklist
              </h2>
              <p className="text-blue-100 text-sm mt-1">
                Complete inventory of all system settings with current values
              </p>
            </div>
            <button
              onClick={generateWordDocument}
              disabled={generating}
              className="px-4 py-2 bg-white text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition-colors inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  Generating...
                </>
              ) : (
                <>
                  <Download size={18} />
                  Export to Word
                </>
              )}
            </button>
          </div>
        </div>

        {/* Settings Display */}
        <div className="space-y-6">
          {SETTINGS_CHECKLIST.map((category) => (
            <div
              key={category.category}
              className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
            >
              {/* Category Header */}
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">
                  {category.category}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {category.description}
                </p>
              </div>

              {/* Settings Table */}
              {category.settings && category.settings.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Setting
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Current Value
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {category.settings.map((setting) => {
                        const isApplicable = isSettingApplicable(setting);
                        if (!isApplicable) return null;

                        const value = getSettingValue(setting);
                        const hasValue = value && value.trim() !== "";

                        return (
                          <tr key={setting.key} className="hover:bg-gray-50">
                            <td className="px-6 py-4">
                              <div className="text-sm font-medium text-gray-900">
                                {setting.label}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                {setting.required && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                                    Required
                                  </span>
                                )}
                                {setting.dependsOn && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                    Conditional
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              {hasValue ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  ✓ Configured
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                                  Not Set
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              {hasValue ? (
                                <div
                                  className={`text-sm ${setting.sensitive ? "font-mono text-gray-600" : "text-gray-900"}`}
                                >
                                  {value.length > 100 ? (
                                    <details className="cursor-pointer">
                                      <summary className="text-blue-600 hover:text-blue-700">
                                        Click to view ({value.length}{" "}
                                        characters)
                                      </summary>
                                      <div className="mt-2 p-3 bg-gray-50 rounded border border-gray-200 whitespace-pre-wrap break-words">
                                        {value}
                                      </div>
                                    </details>
                                  ) : (
                                    <span className="break-words">{value}</span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-sm text-gray-400 italic">
                                  —
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="px-6 py-8 text-center">
                  <FileText size={32} className="mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500 italic">
                    This category is managed through a separate interface in the
                    Settings page.
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h4 className="text-sm font-semibold text-blue-900 mb-2 flex items-center gap-2">
            <FileText size={16} />
            About This Checklist
          </h4>
          <div className="space-y-2 text-sm text-blue-700">
            <p>
              This checklist displays all configurable settings in your system
              with their current values.
            </p>
            <p>
              <strong>Export to Word:</strong> Click the "Export to Word" button
              to download a formatted Microsoft Word document (.doc) containing
              all settings and their current values.
            </p>
            <p>
              <strong>Sensitive Data:</strong> API keys, tokens, and other
              sensitive values are masked with bullets (••••) for security.
            </p>
            <p>
              <strong>Conditional Settings:</strong> Some settings only appear
              when their parent setting is enabled (e.g., Venmo Handle only
              shows when Venmo is enabled).
            </p>
          </div>
        </div>
      </div>
    </PageWithBackButton>
  );
}
