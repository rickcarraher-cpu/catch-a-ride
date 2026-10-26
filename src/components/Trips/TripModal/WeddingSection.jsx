import { useQuery } from "@tanstack/react-query";
import { Heart, AlertCircle, User, Phone, Mail } from "lucide-react";

export default function WeddingSection({ formData, setFormData, tripId }) {
  const isNewTrip = !tripId;

  const { data: weddings = [], isLoading } = useQuery({
    queryKey: ["weddings-active"],
    queryFn: async () => {
      const res = await fetch("/api/weddings?window=all");
      if (!res.ok) return [];
      const data = await res.json();
      return data.sort(
        (a, b) => new Date(b.wedding_date) - new Date(a.wedding_date),
      );
    },
  });

  // Find the selected wedding's details to show coordinator info
  const selectedWedding = weddings.find(
    (w) => w.id === Number(formData.wedding_id),
  );

  return (
    <div className="bg-gradient-to-br from-pink-50 to-rose-50 border border-pink-200 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-9 h-9 bg-gradient-to-br from-pink-500 to-rose-500 rounded-lg flex items-center justify-center">
          <Heart size={18} className="text-white" />
        </div>
        <h3 className="text-base font-bold text-gray-800">
          Wedding Package (Optional)
        </h3>
      </div>

      {/* Warning for new trips */}
      {isNewTrip && (
        <div className="flex items-start gap-2 mb-4 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertCircle size={14} className="text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800 leading-snug">
            <strong>Best practice:</strong> Create wedding trips from within the{" "}
            <strong>Wedding record</strong> so the coordinator's info is
            automatically used as the passenger contact. The wedding must exist
            before any trips can be linked.
          </p>
        </div>
      )}

      <div className="bg-white rounded-lg p-4 border border-pink-100">
        <label className="text-sm font-medium text-gray-700 block mb-2">
          Link to Wedding
        </label>
        <select
          value={formData.wedding_id || ""}
          onChange={(e) =>
            setFormData({
              ...formData,
              wedding_id: e.target.value ? Number(e.target.value) : null,
            })
          }
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-400 focus:border-pink-400 bg-white"
        >
          <option value="">No Wedding</option>
          {isLoading ? (
            <option disabled>Loading weddings...</option>
          ) : (
            weddings.map((wedding) => (
              <option key={wedding.id} value={wedding.id}>
                {wedding.venue_name} -{" "}
                {new Date(wedding.wedding_date).toLocaleDateString()}
              </option>
            ))
          )}
        </select>

        {/* Show coordinator info when a wedding is selected */}
        {formData.wedding_id && selectedWedding && (
          <div className="mt-3 bg-pink-50 border border-pink-200 rounded-lg p-3">
            <p className="text-xs font-bold text-pink-700 uppercase tracking-wide mb-2">
              💒 Coordinator (acts as passenger contact)
            </p>
            <div className="space-y-1">
              {selectedWedding.coordinator_name && (
                <div className="flex items-center gap-1.5 text-xs text-gray-700">
                  <User size={11} className="text-pink-500" />
                  <span className="font-semibold">
                    {selectedWedding.coordinator_name}
                  </span>
                </div>
              )}
              {selectedWedding.coordinator_phone && (
                <div className="flex items-center gap-1.5 text-xs text-gray-600">
                  <Phone size={11} className="text-pink-500" />
                  {selectedWedding.coordinator_phone}
                </div>
              )}
              {selectedWedding.coordinator_email && (
                <div className="flex items-center gap-1.5 text-xs text-gray-600">
                  <Mail size={11} className="text-pink-500" />
                  {selectedWedding.coordinator_email}
                </div>
              )}
            </div>
            <p className="text-[10px] text-pink-600 mt-2 leading-snug">
              Coordinator receives all passenger communications for this wedding
              trip.
            </p>
          </div>
        )}

        {formData.wedding_id && !selectedWedding && (
          <p className="text-xs text-pink-600 mt-2">
            This trip is part of a wedding package
          </p>
        )}
      </div>
    </div>
  );
}
