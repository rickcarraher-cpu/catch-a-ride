"use client";

import { useState } from "react";

export function SettingInput({ label, value, onSave, placeholder = "" }) {
  const [localValue, setLocalValue] = useState(value || "");

  const handleBlur = () => {
    if (localValue !== (value || "")) {
      onSave(localValue);
    }
  };

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
        {label}
      </label>
      <input
        type="text"
        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 focus:outline-none"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        placeholder={placeholder}
      />
    </div>
  );
}
