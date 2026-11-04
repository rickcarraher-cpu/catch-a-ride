import { Search } from "lucide-react";

export function DriversSearch({ value, onChange }) {
  return (
    <div className="relative">
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        size={18}
      />
      <input
        type="text"
        placeholder="Search drivers by name or email..."
        className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
