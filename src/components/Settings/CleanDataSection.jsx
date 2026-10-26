import { Trash2 } from "lucide-react";
import { useState } from "react";

export function CleanDataSection() {
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (confirmText !== "DELETE ALL DATA") {
      alert('Please type "DELETE ALL DATA" to confirm');
      return;
    }

    if (
      !confirm(
        "⚠️ FINAL WARNING: This will permanently delete ALL data from your database. This action CANNOT be undone. Are you absolutely sure?",
      )
    ) {
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch("/api/data/clean-all", {
        method: "POST",
      });

      if (!res.ok) {
        throw new Error("Failed to clean data");
      }

      alert("✅ All data has been deleted successfully");
      setConfirmText("");
      window.location.reload();
    } catch (error) {
      console.error("Error cleaning data:", error);
      alert(`❌ Failed to clean data: ${error.message}`);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="bg-red-50 border-2 border-red-300 rounded-lg p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Trash2 size={20} className="text-red-600" />
        <h3 className="text-base font-semibold text-red-900">
          ⚠️ Danger Zone — Delete All Data
        </h3>
      </div>

      <div className="bg-white border border-red-200 rounded-lg p-4 space-y-3">
        <p className="text-sm text-red-800 font-semibold">
          This will permanently delete:
        </p>
        <ul className="text-sm text-red-700 space-y-1 list-disc list-inside">
          <li>All trips and appointments</li>
          <li>All passengers and clients</li>
          <li>All drivers and employees</li>
          <li>All vehicles</li>
          <li>All transactions and payments</li>
          <li>All messages and communication logs</li>
          <li>All services and settings</li>
        </ul>
        <p className="text-xs text-red-600 font-bold mt-3">
          ⚠️ This action CANNOT be undone. Make sure you have a backup before
          proceeding.
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-semibold text-red-900 mb-2">
            Type "DELETE ALL DATA" to confirm:
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="DELETE ALL DATA"
            className="w-full px-3 py-2 border-2 border-red-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 font-mono"
            disabled={deleting}
          />
        </div>

        <button
          onClick={handleDelete}
          disabled={confirmText !== "DELETE ALL DATA" || deleting}
          className="w-full px-4 py-3 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {deleting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Deleting All Data...
            </>
          ) : (
            <>
              <Trash2 size={18} />
              Delete All Data Permanently
            </>
          )}
        </button>
      </div>
    </div>
  );
}
