import { useState } from "react";
import { MapPin, Pencil, X, Check, Plus, Trash2 } from "lucide-react";

export function PassengerDefaultsSection({ settings, handleUpdate }) {
  // Parse existing locations from settings or initialize empty array
  const savedLocations = settings?.default_passenger_locations
    ? JSON.parse(settings.default_passenger_locations)
    : [];

  const [editing, setEditing] = useState(false);
  const [locations, setLocations] = useState(savedLocations);
  const [newLocation, setNewLocation] = useState({
    city: "",
    state: "",
    zip: "",
  });

  const handleStartEdit = () => {
    setLocations(savedLocations);
    setEditing(true);
  };

  const handleCancel = () => {
    setEditing(false);
    setNewLocation({ city: "", state: "", zip: "" });
  };

  const handleAddLocation = () => {
    if (!newLocation.city || !newLocation.state || !newLocation.zip) {
      return;
    }

    const locationWithId = {
      id: Date.now(),
      ...newLocation,
    };

    setLocations([...locations, locationWithId]);
    setNewLocation({ city: "", state: "", zip: "" });
  };

  const handleRemoveLocation = (id) => {
    setLocations(locations.filter((loc) => loc.id !== id));
  };

  const handleSave = () => {
    // Save locations as JSON string
    handleUpdate("default_passenger_locations", JSON.stringify(locations));
    setEditing(false);
    setNewLocation({ city: "", state: "", zip: "" });
  };

  return (
    <section className="bg-white p-6 rounded-xl border border-gray-200 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-gray-900">
          <MapPin size={18} className="text-blue-600" />
          <h2 className="font-semibold text-lg">New Passenger Defaults</h2>
        </div>
        {!editing && (
          <button
            onClick={handleStartEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <Pencil size={14} />
            {savedLocations.length > 0 ? "Manage" : "Set Defaults"}
          </button>
        )}
      </div>

      <p className="text-xs text-gray-400">
        These locations will be available when adding a new passenger. You can
        select which one to use for each passenger.
      </p>

      {/* Saved values display */}
      {!editing && (
        <div>
          {savedLocations.length > 0 ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-3">
                Currently Saved ({savedLocations.length})
              </p>
              <div className="space-y-2">
                {savedLocations.map((loc) => (
                  <div
                    key={loc.id}
                    className="flex items-center gap-2 bg-white border border-green-200 rounded-lg p-3"
                  >
                    <MapPin size={16} className="text-green-600 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-green-900">
                        {loc.city}, {loc.state} {loc.zip}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-sm text-gray-500 italic">
                No defaults set yet. Click "Set Defaults" to add default
                locations.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Edit form */}
      {editing && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-4">
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
            Manage Default Locations
          </p>

          {/* Existing locations */}
          {locations.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-blue-600">
                Current Locations:
              </p>
              {locations.map((loc) => (
                <div
                  key={loc.id}
                  className="flex items-center gap-2 bg-white border border-blue-200 rounded-lg p-3"
                >
                  <MapPin size={16} className="text-blue-600 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">
                      {loc.city}, {loc.state} {loc.zip}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRemoveLocation(loc.id)}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add new location */}
          <div className="space-y-3 pt-2 border-t border-blue-200">
            <p className="text-xs font-medium text-blue-600">
              Add New Location:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  City
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  value={newLocation.city}
                  onChange={(e) =>
                    setNewLocation({ ...newLocation, city: e.target.value })
                  }
                  placeholder="e.g. Nashville"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  State
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  value={newLocation.state}
                  onChange={(e) =>
                    setNewLocation({
                      ...newLocation,
                      state: e.target.value.toUpperCase(),
                    })
                  }
                  placeholder="e.g. TN"
                  maxLength={2}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  ZIP
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  value={newLocation.zip}
                  onChange={(e) =>
                    setNewLocation({ ...newLocation, zip: e.target.value })
                  }
                  placeholder="e.g. 37066"
                />
              </div>
            </div>
            <button
              onClick={handleAddLocation}
              disabled={
                !newLocation.city || !newLocation.state || !newLocation.zip
              }
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus size={14} />
              Add Location
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2 border-t border-blue-200">
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Check size={14} />
              Save All Changes
            </button>
            <button
              onClick={handleCancel}
              className="flex items-center gap-1.5 px-4 py-2 bg-white text-gray-600 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <X size={14} />
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
