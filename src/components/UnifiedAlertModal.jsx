"use client";

import React from "react";
import {
  AlertTriangle,
  Bell,
  Mail,
  MessageSquare,
  X,
  ChevronRight,
  Calendar,
} from "lucide-react";

/**
 * UnifiedAlertModal — one beautiful modal for all urgent alerts.
 *
 * Props:
 *   type: "cancellation" | "comm_failure" | "sms" | "booking"
 *   title: string
 *   subtitle?: string
 *   badge?: string  (e.g. "+3 more")
 *   fields: [{ label, value }]
 *   actions: [{ label, onClick?, href?, variant: "primary"|"secondary"|"danger" }]
 *   onClose?: fn
 *   extraCount?: number
 */

const TYPE_CONFIG = {
  cancellation: {
    icon: Bell,
    iconBg: "rgba(220,38,38,0.2)",
    iconBorder: "rgba(220,38,38,0.35)",
    iconColor: "#fca5a5",
    accentBar: "linear-gradient(90deg, #fbbf24, #dc2626, #fbbf24)",
    cardBg: "linear-gradient(145deg, #450a0a 0%, #7f1d1d 40%, #991b1b 100%)",
    taglineColor: "#fca5a5",
  },
  comm_failure: {
    icon: AlertTriangle,
    iconBg: "rgba(245,158,11,0.2)",
    iconBorder: "rgba(245,158,11,0.3)",
    iconColor: "#fbbf24",
    accentBar: "linear-gradient(90deg, #f59e0b, #ef4444, #f59e0b)",
    cardBg:
      "linear-gradient(145deg, #1e1b4b 0%, #312e81 30%, #4c1d95 70%, #581c87 100%)",
    taglineColor: "#c4b5fd",
  },
  sms: {
    icon: MessageSquare,
    iconBg: "rgba(59,130,246,0.2)",
    iconBorder: "rgba(59,130,246,0.3)",
    iconColor: "#93c5fd",
    accentBar: "linear-gradient(90deg, #3b82f6, #8b5cf6, #3b82f6)",
    cardBg: "linear-gradient(145deg, #0c1445 0%, #1e3a8a 40%, #1e1b4b 100%)",
    taglineColor: "#93c5fd",
  },
  booking: {
    icon: Calendar,
    iconBg: "rgba(249,115,22,0.2)",
    iconBorder: "rgba(249,115,22,0.3)",
    iconColor: "#fdba74",
    accentBar: "linear-gradient(90deg, #f97316, #ef4444, #f97316)",
    cardBg: "linear-gradient(145deg, #1c0a00 0%, #7c2d12 40%, #9a3412 100%)",
    taglineColor: "#fdba74",
  },
};

const VARIANT_STYLES = {
  primary: "bg-white text-gray-900 hover:bg-gray-100 font-bold shadow-lg",
  secondary:
    "bg-white/15 text-white hover:bg-white/25 font-semibold border border-white/20",
  danger: "bg-red-500 text-white hover:bg-red-400 font-bold shadow-lg",
  accent: "bg-amber-400 text-gray-900 hover:bg-amber-300 font-bold shadow-lg",
};

export default function UnifiedAlertModal({
  type = "comm_failure",
  title,
  subtitle,
  fields = [],
  actions = [],
  extraCount = 0,
  onExtraCountClick,
}) {
  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.comm_failure;
  const Icon = cfg.icon;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center"
      style={{
        backgroundColor: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
    >
      <div
        className="w-full max-w-lg mx-4"
        style={{
          animation:
            "unifiedSlideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both",
        }}
      >
        <div
          className="rounded-2xl shadow-2xl overflow-hidden"
          style={{
            background: cfg.cardBg,
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          {/* Glowing top bar */}
          <div
            className="h-1.5"
            style={{
              background: cfg.accentBar,
              animation: "unifiedGlow 2.5s ease-in-out infinite",
            }}
          />

          {/* Header */}
          <div className="px-6 pt-5 pb-3 flex items-start gap-4">
            <div
              className="flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center"
              style={{
                background: cfg.iconBg,
                border: `1px solid ${cfg.iconBorder}`,
                animation: "unifiedIconPulse 2.5s ease-in-out infinite",
              }}
            >
              <Icon
                size={28}
                style={{ color: cfg.iconColor }}
                strokeWidth={2.5}
              />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-white font-bold text-lg tracking-tight leading-tight">
                  {title}
                </h2>
                {extraCount > 0 && (
                  <button
                    onClick={onExtraCountClick}
                    className="bg-red-500 text-white text-xs font-bold px-2.5 py-0.5 rounded-full hover:bg-red-400 transition-colors"
                    style={{
                      animation: "unifiedBadgePulse 1.5s ease-in-out infinite",
                    }}
                  >
                    +{extraCount} more
                  </button>
                )}
              </div>
              {subtitle && (
                <p
                  className="text-sm mt-0.5"
                  style={{ color: cfg.taglineColor }}
                >
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {/* Fields */}
          {fields.length > 0 && (
            <div className="px-6 pb-4">
              <div
                className="rounded-xl p-4 space-y-3"
                style={{
                  background: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                {fields.map((field, i) => (
                  <div key={i}>
                    {field.label && (
                      <p className="text-white/50 text-xs uppercase tracking-wider font-semibold mb-0.5">
                        {field.label}
                      </p>
                    )}
                    {field.isError ? (
                      <div className="bg-red-500/10 border border-red-400/20 rounded-lg px-3 py-2">
                        <p className="text-red-300 text-sm break-words leading-relaxed">
                          {field.value}
                        </p>
                      </div>
                    ) : field.isMono ? (
                      <p className="text-white text-sm font-mono bg-black/20 px-3 py-1.5 rounded-lg break-all">
                        {field.value}
                      </p>
                    ) : field.isBig ? (
                      <p className="text-white font-bold text-base">
                        {field.value}
                      </p>
                    ) : field.isQuote ? (
                      <p className="text-yellow-200 text-sm italic">
                        "{field.value}"
                      </p>
                    ) : field.isBadgeRow ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        {field.badges.map((b, bi) => (
                          <React.Fragment key={bi}>
                            {bi > 0 && (
                              <ChevronRight
                                size={14}
                                className="text-white/30"
                              />
                            )}
                            <span
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
                              style={{
                                background: b.bg || "rgba(255,255,255,0.1)",
                                color: b.color || "#fff",
                                border: `1px solid ${b.border || "rgba(255,255,255,0.2)"}`,
                              }}
                            >
                              {b.icon && <b.icon size={12} />}
                              {b.label}
                            </span>
                          </React.Fragment>
                        ))}
                      </div>
                    ) : (
                      <p className="text-white/80 text-sm">{field.value}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          {actions.length > 0 && (
            <div className="px-6 pb-5 flex gap-3 flex-wrap">
              {actions.map((action, i) =>
                action.href ? (
                  <a
                    key={i}
                    href={action.href}
                    onClick={action.onClick}
                    className={`flex-1 min-w-[100px] py-3 px-4 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-sm ${VARIANT_STYLES[action.variant || "secondary"]}`}
                  >
                    {action.icon && <action.icon size={15} />}
                    {action.label}
                  </a>
                ) : (
                  <button
                    key={i}
                    onClick={action.onClick}
                    disabled={action.disabled}
                    className={`flex-1 min-w-[100px] py-3 px-4 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-sm disabled:opacity-50 ${VARIANT_STYLES[action.variant || "secondary"]}`}
                  >
                    {action.icon && <action.icon size={15} />}
                    {action.label}
                  </button>
                ),
              )}
            </div>
          )}
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes unifiedSlideIn {
          from { transform: translateY(30px) scale(0.92); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes unifiedGlow {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.55; }
        }
        @keyframes unifiedIconPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,255,255,0.1); }
          50% { box-shadow: 0 0 0 10px rgba(255,255,255,0); }
        }
        @keyframes unifiedBadgePulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
      `,
        }}
      />
    </div>
  );
}
