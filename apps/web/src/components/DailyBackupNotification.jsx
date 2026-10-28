"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, Database, Clock, X } from "lucide-react";

/**
 * DailyBackupNotification Component
 *
 * Polls for new daily backups and displays a beautiful popup when one completes.
 * The popup stays open until the user closes it.
 */
export default function DailyBackupNotification() {
  const [showPopup, setShowPopup] = useState(false);
  const [backupTimestamp, setBackupTimestamp] = useState(null);
  const [ready, setReady] = useState(false);

  // Wait for client mount
  useEffect(() => {
    setReady(true);
  }, []);

  // Poll for new backups every 2 minutes (was 30s — daily backups don't need aggressive polling)
  useEffect(() => {
    if (!ready) return;

    let cancelled = false;

    const checkForNewBackup = async () => {
      try {
        const response = await fetch("/api/data/backup/check-daily");
        if (!response.ok) return;
        const data = await response.json();

        if (!cancelled && data.has_new_backup && data.backup_timestamp) {
          setBackupTimestamp(data.backup_timestamp);
          setShowPopup(true);
        }
      } catch (err) {
        // Silently fail — never break the app for a notification check
      }
    };

    checkForNewBackup();
    const interval = setInterval(checkForNewBackup, 120000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [ready]);

  const handleClose = async () => {
    try {
      if (backupTimestamp) {
        await fetch("/api/data/backup/check-daily", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ backup_timestamp: backupTimestamp }),
        });
      }
    } catch (err) {
      // Silently fail
    }
    setShowPopup(false);
    setBackupTimestamp(null);
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "";
    try {
      return new Date(timestamp).toLocaleString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: "America/Chicago",
      });
    } catch {
      return timestamp;
    }
  };

  if (!ready || !showPopup) return null;

  return (
    <>
      {/* Overlay */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0,0,0,0.6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 99999,
          animation: "dbNotifFadeIn 0.3s ease-out",
        }}
      >
        {/* Modal card */}
        <div
          style={{
            background: "linear-gradient(135deg, #f0fdf4, #ecfdf5)",
            borderRadius: "16px",
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
            maxWidth: "480px",
            width: "calc(100% - 32px)",
            overflow: "hidden",
            animation: "dbNotifSlideUp 0.4s ease-out",
          }}
        >
          {/* Header */}
          <div
            style={{
              background: "linear-gradient(to right, #16a34a, #059669)",
              padding: "24px 32px",
              position: "relative",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div
                style={{
                  backgroundColor: "rgba(255,255,255,0.2)",
                  borderRadius: "50%",
                  padding: "16px",
                }}
              >
                <Database size={40} color="white" />
              </div>
              <div style={{ flex: 1 }}>
                <h2
                  style={{
                    fontSize: "22px",
                    fontWeight: "bold",
                    color: "white",
                    margin: 0,
                    letterSpacing: "-0.025em",
                  }}
                >
                  Daily Backup Completed
                </h2>
                <p
                  style={{
                    color: "#bbf7d0",
                    fontSize: "14px",
                    margin: "4px 0 0",
                  }}
                >
                  Your data has been safely backed up
                </p>
              </div>
            </div>

            {/* Close X */}
            <button
              onClick={handleClose}
              aria-label="Close notification"
              style={{
                position: "absolute",
                top: "16px",
                right: "16px",
                padding: "8px",
                borderRadius: "50%",
                backgroundColor: "rgba(255,255,255,0.2)",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
              }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div
            style={{
              padding: "32px",
              display: "flex",
              flexDirection: "column",
              gap: "24px",
            }}
          >
            {/* Checkmark */}
            <div style={{ display: "flex", justifyContent: "center" }}>
              <div
                style={{
                  backgroundColor: "#dcfce7",
                  borderRadius: "50%",
                  padding: "24px",
                  animation: "dbNotifPulse 2s ease-in-out infinite",
                }}
              >
                <CheckCircle2 size={64} color="#16a34a" />
              </div>
            </div>

            {/* Timestamp card */}
            <div
              style={{
                backgroundColor: "white",
                border: "2px solid #bbf7d0",
                borderRadius: "12px",
                padding: "20px",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "12px" }}
              >
                <Clock size={20} color="#16a34a" />
                <div>
                  <p
                    style={{
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "#166534",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      margin: 0,
                    }}
                  >
                    Backup Completed At
                  </p>
                  <p
                    style={{
                      fontSize: "18px",
                      fontWeight: "bold",
                      color: "#14532d",
                      margin: "4px 0 0",
                    }}
                  >
                    {formatTimestamp(backupTimestamp)}
                  </p>
                </div>
              </div>
            </div>

            {/* Info */}
            <div
              style={{
                backgroundColor: "#eff6ff",
                border: "1px solid #bfdbfe",
                borderRadius: "8px",
                padding: "16px",
              }}
            >
              <p
                style={{
                  fontSize: "14px",
                  color: "#1e40af",
                  margin: 0,
                  fontWeight: 600,
                }}
              >
                ✓ All your data is protected.
              </p>
              <p
                style={{
                  fontSize: "12px",
                  color: "#3b82f6",
                  margin: "6px 0 0",
                }}
              >
                This backup runs automatically every day at 5 PM CDT to keep
                your information safe.
              </p>
            </div>

            {/* CTA */}
            <button
              onClick={handleClose}
              style={{
                width: "100%",
                background: "linear-gradient(to right, #16a34a, #059669)",
                color: "white",
                fontWeight: 600,
                fontSize: "16px",
                padding: "16px 24px",
                borderRadius: "12px",
                border: "none",
                cursor: "pointer",
                boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                transition: "transform 0.15s, box-shadow 0.15s",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = "scale(1.02)";
                e.currentTarget.style.boxShadow =
                  "0 20px 25px -5px rgba(0,0,0,0.1)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.boxShadow =
                  "0 10px 15px -3px rgba(0,0,0,0.1)";
              }}
            >
              Got It, Thanks!
            </button>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes dbNotifFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes dbNotifSlideUp {
          from { transform: translateY(30px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes dbNotifPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
      `}</style>
    </>
  );
}
