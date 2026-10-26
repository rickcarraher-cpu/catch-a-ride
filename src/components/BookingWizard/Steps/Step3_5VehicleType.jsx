import { useQuery } from "@tanstack/react-query";
import { Car, Loader } from "lucide-react";

export function Step3_5VehicleType({ formData, set, isPassengerMode = true }) {
  // Fetch unique vehicle categories
  const { data, isLoading } = useQuery({
    queryKey: ["vehicle-categories"],
    queryFn: async () => {
      const res = await fetch("/api/vehicles/categories");
      if (!res.ok) throw new Error("Failed to fetch vehicle categories");
      return res.json();
    },
  });

  const categories = data?.categories || [];

  const handleSelect = (category) => {
    set({ vehicle_category: category });
  };

  return (
    <>
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          {isPassengerMode
            ? "What type of vehicle do you prefer?"
            : "What type of vehicle is needed?"}
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          {isPassengerMode
            ? "Select your preferred vehicle type (optional)"
            : "Select the vehicle type for this trip — required"}
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      ) : categories.length === 0 ? (
        <div className="text-center py-12">
          <Car size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">
            No vehicle types available. Please add vehicle categories in
            Settings.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Vehicle category options — "No Preference" removed, a selection is required */}
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => handleSelect(category)}
              className={`w-full text-left p-4 border-2 rounded-2xl transition-all ${
                formData.vehicle_category === category
                  ? "border-blue-500 bg-blue-50 ring-4 ring-blue-100"
                  : "border-gray-200 hover:border-gray-300 bg-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full border-2 border-blue-500 flex items-center justify-center shrink-0">
                  {formData.vehicle_category === category && (
                    <div className="w-3 h-3 rounded-full bg-blue-600" />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Car size={18} className="text-blue-600" />
                  <p className="font-bold text-sm text-gray-900">{category}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Info note */}
      <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4 mt-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
            <span className="text-white text-xl">ℹ️</span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-blue-900 mb-1">
              Vehicle Preference
            </p>
            <p className="text-sm text-blue-800 leading-relaxed">
              {isPassengerMode
                ? "This is your preference. The actual vehicle will be assigned based on availability."
                : "This preference will be saved with the trip. A specific vehicle will be assigned later."}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
