"use client";

import React from "react";
import { CheckCircle2 } from "lucide-react";

export default function BackupOnCloseModal({ onExit, onStay }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100]">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-6 py-5 flex items-center gap-3">
          <CheckCircle2 size={32} className="text-white" strokeWidth={2.5} />
          <h2 className="text-2xl font-bold text-white">Backup Completed</h2>
        </div>

        {/* Body */}
        <div className="px-6 py-6">
          <p className="text-gray-700 text-lg text-center">
            Do you want to exit now?
          </p>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onStay}
            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 px-6 rounded-lg transition-all"
          >
            No, Stay
          </button>
          <button
            onClick={onExit}
            className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold py-3 px-6 rounded-lg transition-all shadow-md"
          >
            Yes, Exit
          </button>
        </div>
      </div>
    </div>
  );
}
