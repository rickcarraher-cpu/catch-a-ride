"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react";

// ── Context ────────────────────────────────────────────────────────────────────
const SystemMessageContext = createContext(null);

// ── Config per type ────────────────────────────────────────────────────────────
const TYPE_CONFIG = {
  success: {
    icon: CheckCircle,
    accent: "#22c55e",
    accentDark: "#16a34a",
    bg: "linear-gradient(135deg, #052e16 0%, #14532d 50%, #1a3a28 100%)",
    border: "rgba(34,197,94,0.25)",
    iconBg: "rgba(34,197,94,0.15)",
    iconBorder: "rgba(34,197,94,0.3)",
    iconColor: "#4ade80",
    barGradient: "linear-gradient(90deg, #22c55e, #86efac)",
    tagline: "Success",
  },
  error: {
    icon: XCircle,
    accent: "#ef4444",
    accentDark: "#dc2626",
    bg: "linear-gradient(135deg, #1c0505 0%, #450a0a 50%, #3b0f0f 100%)",
    border: "rgba(239,68,68,0.25)",
    iconBg: "rgba(239,68,68,0.15)",
    iconBorder: "rgba(239,68,68,0.3)",
    iconColor: "#f87171",
    barGradient: "linear-gradient(90deg, #ef4444, #fca5a5)",
    tagline: "Error",
  },
  warning: {
    icon: AlertTriangle,
    accent: "#f59e0b",
    accentDark: "#d97706",
    bg: "linear-gradient(135deg, #1c1200 0%, #451a03 50%, #3b1e05 100%)",
    border: "rgba(245,158,11,0.25)",
    iconBg: "rgba(245,158,11,0.15)",
    iconBorder: "rgba(245,158,11,0.3)",
    iconColor: "#fbbf24",
    barGradient: "linear-gradient(90deg, #f59e0b, #fde68a)",
    tagline: "Warning",
  },
  info: {
    icon: Info,
    accent: "#3b82f6",
    accentDark: "#2563eb",
    bg: "linear-gradient(135deg, #030d1c 0%, #0c1e4a 50%, #0f2040 100%)",
    border: "rgba(59,130,246,0.25)",
    iconBg: "rgba(59,130,246,0.15)",
    iconBorder: "rgba(59,130,246,0.3)",
    iconColor: "#60a5fa",
    barGradient: "linear-gradient(90deg, #3b82f6, #93c5fd)",
    tagline: "Info",
  },
};

// ── Single Toast Modal ─────────────────────────────────────────────────────────
function SystemModal({
  id,
  type = "info",
  title,
  message,
  duration = 4500,
  onDismiss,
}) {
  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.info;
  const Icon = cfg.icon;
  const [progress, setProgress] = useState(100);
  const [visible, setVisible] = useState(false);
  const intervalRef = useRef(null);
  const startRef = useRef(Date.now());

  useEffect(() => {
    // Mount animation
    const t = setTimeout(() => setVisible(true), 10);

    // Progress bar countdown
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining <= 0) {
        clearInterval(intervalRef.current);
        handleDismiss();
      }
    }, 50);

    return () => {
      clearTimeout(t);
      clearInterval(intervalRef.current);
    };
  }, []);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    setTimeout(() => onDismiss(id), 350);
  }, [id, onDismiss]);

  return (
    <div
      style={{
        transition: "all 0.35s cubic-bezier(0.34,1.56,0.64,1)",
        transform: visible
          ? "translateY(0) scale(1)"
          : "translateY(-30px) scale(0.88)",
        opacity: visible ? 1 : 0,
      }}
    >
      <div
        style={{
          background: cfg.bg,
          border: `1px solid ${cfg.border}`,
          borderRadius: 20,
          overflow: "hidden",
          boxShadow: `0 25px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05), 0 0 40px ${cfg.accent}22`,
          minWidth: 360,
          maxWidth: 480,
          position: "relative",
        }}
      >
        {/* Glowing top bar */}
        <div
          style={{
            height: 4,
            background: cfg.barGradient,
            animation: "sysBarGlow 2.5s ease-in-out infinite",
          }}
        />

        {/* Body */}
        <div
          style={{
            padding: "20px 22px 16px",
            display: "flex",
            gap: 16,
            alignItems: "flex-start",
          }}
        >
          {/* Icon */}
          <div
            style={{
              flexShrink: 0,
              width: 48,
              height: 48,
              borderRadius: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: cfg.iconBg,
              border: `1px solid ${cfg.iconBorder}`,
              animation: "sysIconPop 0.45s cubic-bezier(0.34,1.56,0.64,1) both",
            }}
          >
            <Icon size={24} color={cfg.iconColor} strokeWidth={2.5} />
          </div>

          {/* Text */}
          <div style={{ flex: 1, minWidth: 0, paddingTop: 3 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 4,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: cfg.iconColor,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                {cfg.tagline}
              </span>
            </div>
            {title && (
              <p
                style={{
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 15,
                  lineHeight: 1.3,
                  marginBottom: 4,
                }}
              >
                {title}
              </p>
            )}
            {message && (
              <p
                style={{
                  color: "rgba(255,255,255,0.72)",
                  fontSize: 13.5,
                  lineHeight: 1.5,
                }}
              >
                {message}
              </p>
            )}
          </div>

          {/* Close button */}
          <button
            onClick={handleDismiss}
            style={{
              flexShrink: 0,
              marginTop: 2,
              width: 28,
              height: 28,
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.07)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "background 0.15s",
              color: "rgba(255,255,255,0.5)",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "rgba(255,255,255,0.15)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "rgba(255,255,255,0.07)")
            }
          >
            <X size={14} />
          </button>
        </div>

        {/* Progress bar */}
        <div
          style={{
            height: 3,
            background: "rgba(255,255,255,0.06)",
            margin: "0 22px 16px",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progress}%`,
              background: cfg.barGradient,
              borderRadius: 2,
              transition: "width 50ms linear",
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ── Provider ───────────────────────────────────────────────────────────────────
export function SystemMessageProvider({ children }) {
  const [queue, setQueue] = useState([]);
  const counterRef = useRef(0);

  const push = useCallback((type, titleOrMsg, maybeMsg, opts = {}) => {
    const isSimple = maybeMsg === undefined || typeof maybeMsg !== "string";
    const title = isSimple ? null : titleOrMsg;
    const message = isSimple ? titleOrMsg : maybeMsg;
    const id = ++counterRef.current;
    const duration = opts.duration ?? 4500;
    setQueue((q) => [...q, { id, type, title, message, duration }]);
  }, []);

  const dismiss = useCallback((id) => {
    setQueue((q) => q.filter((m) => m.id !== id));
  }, []);

  // Wire up window event so notify.js (module-level) can call into React
  useEffect(() => {
    const handler = (e) => {
      const { type, title, message, opts } = e.detail;
      push(type, title, message, opts);
    };
    window.addEventListener("__sysMsg", handler);
    return () => window.removeEventListener("__sysMsg", handler);
  }, [push]);

  return (
    <SystemMessageContext.Provider value={{ push, dismiss }}>
      {children}

      {/* Modal stack — top center */}
      {queue.length > 0 && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 999999,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-start",
            paddingTop: 32,
            paddingLeft: 16,
            paddingRight: 16,
            gap: 12,
            pointerEvents: "none",
          }}
        >
          {/* Semi-transparent backdrop only when a message is present */}
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.45)",
              backdropFilter: "blur(4px)",
              WebkitBackdropFilter: "blur(4px)",
              animation: "sysFadeIn 0.2s ease both",
              pointerEvents: "all",
            }}
            onClick={() => dismiss(queue[0].id)}
          />

          {/* Show only the latest (top of queue) to avoid clutter */}
          {queue.slice(-1).map((msg) => (
            <div
              key={msg.id}
              style={{ position: "relative", zIndex: 1, pointerEvents: "all" }}
            >
              <SystemModal {...msg} onDismiss={dismiss} />
              {queue.length > 1 && (
                <div
                  style={{
                    textAlign: "center",
                    marginTop: 8,
                    color: "rgba(255,255,255,0.5)",
                    fontSize: 12,
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                  }}
                >
                  {queue.length - 1} more queued
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes sysFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes sysBarGlow {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        @keyframes sysIconPop {
          from { transform: scale(0.5); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </SystemMessageContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────────────────────────
export function useSystemMessage() {
  return useContext(SystemMessageContext);
}
