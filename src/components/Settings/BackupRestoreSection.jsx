import { useState, useEffect } from "react";
import {
  Database,
  Download,
  Upload,
  Clock,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

// Format a UTC ISO timestamp to CDT display
function formatCDT(isoString) {
  if (!isoString || isoString === "Unknown") return null;
  try {
    return new Date(isoString).toLocaleString("en-US", {
      timeZone: "America/Chicago",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZoneName: "short",
    });
  } catch {
    return null;
  }
}

export function BackupRestoreSection() {
  const [backupStatus, setBackupStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [backing, setBacking] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [result, setResult] = useState(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [testingCron, setTestingCron] = useState(false);

  useEffect(() => {
    loadBackupStatus();
  }, []);

  const loadBackupStatus = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/data/backup/status");
      const data = await response.json();
      setBackupStatus(data);
      // cron_last_success and cron_last_error are already included in the status response
    } catch (err) {
      console.error("[BackupRestore] Failed to load backup status:", err);
      setBackupStatus({ exists: false, error: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleBackup = async () => {
    setBacking(true);
    setResult(null);
    try {
      const response = await fetch("/api/data/backup", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Backup failed");
      setResult({
        success: true,
        message: data.message,
        details: data.details,
      });
      await loadBackupStatus();
    } catch (err) {
      console.error("Backup error:", err);
      setResult({ success: false, error: err.message });
    } finally {
      setBacking(false);
    }
  };

  const handleRestoreClick = () => {
    setConfirmRestore(true);
  };

  const handleRestore = async () => {
    if (confirmText !== "RESTORE") return;
    setRestoring(true);
    setResult(null);
    try {
      const response = await fetch("/api/data/restore", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Restore failed");
      setResult({
        success: true,
        message: data.message,
        details: data.details,
      });
      setConfirmRestore(false);
      setConfirmText("");
      await loadBackupStatus();
    } catch (err) {
      console.error("Restore error:", err);
      setResult({ success: false, error: err.message });
    } finally {
      setRestoring(false);
    }
  };

  const handleTestCronBackup = async () => {
    setTestingCron(true);
    try {
      // Use regular backup endpoint to avoid triggering notification popup for everyone
      const response = await fetch("/api/data/backup", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Backup failed");
      alert(
        "Manual backup completed successfully. (This does NOT trigger the daily notification popup - only the scheduled 5 PM backup does that.)",
      );
      await loadBackupStatus(); // Refresh status to show new backup
    } catch (err) {
      console.error("Backup error:", err);
      alert("Failed to trigger backup. Check console for details.");
    } finally {
      setTestingCron(false);
    }
  };

  const lastBackupFormatted = backupStatus?.exists
    ? formatCDT(backupStatus.last_backup)
    : null;
  const changesSince = backupStatus?.changes_since_backup ?? 0;
  const hasChanges = changesSince > 0;

  // --- Cron health detection ---
  const backupTs = backupStatus?.last_backup
    ? new Date(backupStatus.last_backup)
    : null;
  const cronTs = backupStatus?.cron_last_success
    ? new Date(backupStatus.cron_last_success)
    : null;
  const now = new Date();

  // True problem: cron ran AFTER the backup timestamp, meaning cron reported success but the DB write didn't persist
  const cronRanButBackupNotSaved = cronTs && backupTs && cronTs > backupTs;

  // Cron hasn't fired in over 25 hours (skipped at least one daily run)
  const cronIsStale = cronTs && now - cronTs > 25 * 60 * 60 * 1000;
  // If we've never recorded a cron success at all, also flag it
  const cronNeverRan = backupStatus?.exists && !backupStatus?.cron_last_success;

  return (
    <div className="bg-white border border-blue-200 rounded-lg p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Database size={16} className="text-blue-600" />
            <p className="text-sm font-medium text-gray-800">
              Backup & Restore System
            </p>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Create backups to protect your data and restore if needed
          </p>
        </div>
      </div>

      {/* Backup Status */}
      {loading ? (
        <div className="text-sm text-gray-500">Loading backup status...</div>
      ) : backupStatus?.exists ? (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
          {/* Last backup time — prominent */}
          <div className="flex items-center gap-2">
            <Clock size={15} className="text-blue-600 shrink-0" />
            <div>
              <span className="text-xs font-semibold text-blue-800 uppercase tracking-wide">
                Last Backup
              </span>
              <p className="text-sm font-bold text-blue-900 leading-tight">
                {lastBackupFormatted ?? "Unknown time"}
              </p>
            </div>
          </div>

          {/* Diagnostic: Cron ran but backup timestamp didn't save (real DB write failure) */}
          {cronRanButBackupNotSaved && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
              <AlertTriangle
                size={14}
                className="text-amber-600 shrink-0 mt-0.5"
              />
              <div className="text-xs text-amber-800">
                <p className="font-bold">⚠️ Cron Ran But Backup Didn't Save</p>
                <p className="mt-0.5">
                  <span className="font-semibold">Cron last ran:</span>{" "}
                  {formatCDT(backupStatus.cron_last_success)}
                </p>
                <p className="mt-0.5">
                  <span className="font-semibold">Last saved backup:</span>{" "}
                  {lastBackupFormatted}
                </p>
                <p className="mt-1 text-amber-700">
                  The cron ran successfully but the backup timestamp in the
                  database is older. This may indicate a DB write failure. Run a
                  manual backup to resolve.
                </p>
              </div>
            </div>
          )}

          {/* Diagnostic: Cron is stale / never ran */}
          {(cronIsStale || cronNeverRan) && !cronRanButBackupNotSaved && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-2.5">
              <AlertTriangle
                size={14}
                className="text-red-600 shrink-0 mt-0.5"
              />
              <div className="text-xs text-red-800">
                <p className="font-bold">🚨 Automated Backup Not Running</p>
                {cronNeverRan ? (
                  <p className="mt-0.5">
                    No automated cron run has ever been recorded. The daily 5 PM
                    backup may not be configured correctly.
                  </p>
                ) : (
                  <p className="mt-0.5">
                    <span className="font-semibold">Last cron run:</span>{" "}
                    {formatCDT(backupStatus.cron_last_success)} — more than 24
                    hours ago. The scheduled backup may be failing or timing
                    out.
                  </p>
                )}
                <p className="mt-1 text-red-700">
                  Use the "Create Backup" button below to manually back up your
                  data, and check your Vercel cron logs for errors.
                </p>
              </div>
            </div>
          )}

          {/* Show cron errors if any */}
          {backupStatus?.cron_last_error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-2.5">
              <AlertTriangle
                size={14}
                className="text-red-600 shrink-0 mt-0.5"
              />
              <div className="text-xs text-red-800">
                <p className="font-bold">❌ Cron Error Detected</p>
                <p className="mt-0.5">
                  <span className="font-semibold">Timestamp:</span>{" "}
                  {formatCDT(backupStatus.cron_last_error.timestamp) ??
                    backupStatus.cron_last_error.timestamp}
                </p>
                <p className="mt-0.5">
                  <span className="font-semibold">Error:</span>{" "}
                  {backupStatus.cron_last_error.error}
                </p>
              </div>
            </div>
          )}

          <div className="text-xs text-blue-600 space-y-0.5 border-t border-blue-100 pt-2">
            <div>
              Total Records: {backupStatus.total_records?.toLocaleString()}
            </div>
            <div>Tables: {backupStatus.backup_tables}</div>
          </div>

          {/* Changes since backup */}
          {hasChanges ? (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
              <AlertTriangle
                size={14}
                className="text-amber-600 shrink-0 mt-0.5"
              />
              <p className="text-xs text-amber-800 font-medium">
                <span className="font-bold">
                  {changesSince} new record{changesSince !== 1 ? "s" : ""}
                </span>{" "}
                added since this backup (trips, clients, transactions,
                payments). Create a new backup to include them.
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-lg p-2.5">
              <CheckCircle2 size={14} className="text-green-600 shrink-0" />
              <p className="text-xs text-green-800 font-medium">
                No new data since this backup — you're up to date.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-xs text-yellow-700 font-medium">
            ⚠️ No backup found. Create your first backup to protect your data.
          </p>
        </div>
      )}

      {/* Backup Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleBackup}
          disabled={backing}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Download size={16} />
          {backing ? "Creating Backup..." : "Create Backup"}
        </button>

        <button
          onClick={handleRestoreClick}
          disabled={!backupStatus?.exists || restoring}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Upload size={16} />
          Restore Backup
        </button>
      </div>

      {/* Test Daily Backup Button */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🕐</span>
          <div>
            <p className="text-sm font-semibold text-purple-900">
              Test Daily Backup (5 PM CDT)
            </p>
            <p className="text-xs text-purple-600">
              Trigger the automated backup and see the popup notification
            </p>
          </div>
        </div>
        <button
          onClick={handleTestCronBackup}
          disabled={testingCron}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {testingCron ? "Running Daily Backup..." : "🚀 Test Daily Backup Now"}
        </button>
      </div>

      {/* Restore Confirmation Modal */}
      {confirmRestore && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => {
            setConfirmRestore(false);
            setConfirmText("");
          }}
        >
          <div
            className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 text-orange-600">
              <span className="text-2xl">⚠️</span>
              <h3 className="text-lg font-semibold text-gray-900">
                Confirm Restore
              </h3>
            </div>

            {/* Last backup reminder */}
            {lastBackupFormatted && (
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                <Clock size={13} className="text-blue-500 shrink-0" />
                <p className="text-xs text-blue-800">
                  Restoring backup from{" "}
                  <span className="font-bold">{lastBackupFormatted}</span>
                </p>
              </div>
            )}

            {/* Changes warning — shown only if there ARE changes */}
            {hasChanges && (
              <div className="bg-red-50 border border-red-300 rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle size={15} className="text-red-600 shrink-0" />
                  <p className="text-sm font-bold text-red-700">
                    Data Loss Warning
                  </p>
                </div>
                <p className="text-xs text-red-700">
                  <span className="font-bold">
                    {changesSince} record{changesSince !== 1 ? "s" : ""}
                  </span>{" "}
                  were added after this backup and will be{" "}
                  <span className="font-bold">permanently deleted</span> if you
                  restore.
                </p>
                <p className="text-xs text-red-600">
                  Cancel and create a fresh backup first if you want to keep
                  this data.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-sm font-medium text-orange-800">
                This will replace ALL current data with the backup data.
              </p>
              <p className="text-xs text-orange-600">
                Any changes made since the last backup will be lost. This action
                cannot be undone.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Type "RESTORE" to confirm:
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="RESTORE"
                autoFocus
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={handleRestore}
                disabled={restoring || confirmText !== "RESTORE"}
                className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {restoring ? "Restoring..." : "Confirm Restore"}
              </button>
              <button
                onClick={() => {
                  setConfirmRestore(false);
                  setConfirmText("");
                }}
                disabled={restoring}
                className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Result Messages */}
      {result && result.success && (
        <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3 space-y-2">
          <div className="font-medium">{result.message}</div>
          {result.details && (
            <details className="text-xs">
              <summary className="cursor-pointer hover:text-green-800">
                View Details
              </summary>
              <div className="mt-2 space-y-1">
                {Object.entries(result.details).map(([table, count]) => (
                  <div key={table} className="flex justify-between">
                    <span>{table}:</span>
                    <span className="font-mono">{count} records</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
      {result && !result.success && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="font-medium">Error:</div>
          <div>{result.error}</div>
        </div>
      )}

      {/* Info */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
        <p className="text-xs text-gray-600">
          <strong>How it works:</strong>
        </p>
        <ul className="text-xs text-gray-600 mt-2 space-y-1 list-disc list-inside">
          <li>
            <strong>Create Backup:</strong> Copies all your data to backup
            tables (overwrites previous backup)
          </li>
          <li>
            <strong>Restore Backup:</strong> Replaces all current data with
            backup data
          </li>
          <li>
            <strong>Daily Automated Backup:</strong> Runs automatically every
            day at 5 PM CDT
          </li>
          <li>Only one backup is maintained at a time</li>
          <li>All data is stored internally in your database</li>
          <li>A popup notification appears when the daily backup completes</li>
        </ul>
      </div>
    </div>
  );
}
