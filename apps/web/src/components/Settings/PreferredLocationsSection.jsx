import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/utils/notify";
import { MapPin, Plus, Pencil, Trash2, X } from "lucide-react";

export function PreferredLocationsSection() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    label: "",
    street: "",
    city: "",
    state: "TN",
    zip: "",
    emoji: "📍",
    display_order: 0,
    email: "",
    is_airport: false,
    pickup_dropoff_instructions: "",
  });

  // Fetch locations
  const { data: locations = [], isLoading } = useQuery({
    queryKey: ["preferred-locations"],
    queryFn: async () => {
      const res = await fetch("/api/settings/preferred-locations");
      if (!res.ok) throw new Error("Failed to fetch locations");
      return res.json();
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data) => {
      const res = await fetch("/api/settings/preferred-locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create location");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["preferred-locations"] });
      toast.success("Location added successfully");
      resetForm();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const res = await fetch(`/api/settings/preferred-locations/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update location");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["preferred-locations"] });
      toast.success("Location updated successfully");
      resetForm();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const res = await fetch(`/api/settings/preferred-locations/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete location");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["preferred-locations"] });
      toast.success("Location deleted successfully");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      label: "",
      street: "",
      city: "",
      state: "TN",
      zip: "",
      emoji: "📍",
      display_order: 0,
      email: "",
      is_airport: false,
      pickup_dropoff_instructions: "",
    });
    setShowForm(false);
    setEditingId(null);
  };

  const handleEdit = (location) => {
    setFormData({
      label: location.label,
      street: location.street,
      city: location.city,
      state: location.state,
      zip: location.zip,
      emoji: location.emoji || "📍",
      display_order: location.display_order || 0,
      email: location.email || "",
      is_airport: location.is_airport || false,
      pickup_dropoff_instructions: location.pickup_dropoff_instructions || "",
    });
    setEditingId(location.id);
    setShowForm(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id, label) => {
    if (confirm(`Are you sure you want to delete "${label}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MapPin className="text-blue-600" size={20} />
          <h3 className="text-lg font-bold text-gray-800">
            Preferred Locations
          </h3>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />
            Add Location
          </button>
        )}
      </div>

      <p className="text-sm text-gray-600 mb-4">
        Manage quick-select locations for the booking wizard. These replace the
        hardcoded locations and appear in Step 4.
      </p>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200"
        >
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-gray-800">
              {editingId ? "Edit Location" : "Add New Location"}
            </h4>
            <button
              type="button"
              onClick={resetForm}
              className="text-gray-500 hover:text-gray-700"
            >
              <X size={20} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Label *
              </label>
              <input
                type="text"
                value={formData.label}
                onChange={(e) =>
                  setFormData({ ...formData, label: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., BNA Airport"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Emoji
              </label>
              <input
                type="text"
                value={formData.emoji}
                onChange={(e) =>
                  setFormData({ ...formData, emoji: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="🛫"
                maxLength={2}
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Street Address *
            </label>
            <input
              type="text"
              value={formData.street}
              onChange={(e) =>
                setFormData({ ...formData, street: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., 1 Terminal Drive"
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                City *
              </label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) =>
                  setFormData({ ...formData, city: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Nashville"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                State *
              </label>
              <input
                type="text"
                value={formData.state}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    state: e.target.value.toUpperCase(),
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="TN"
                maxLength={2}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ZIP Code *
              </label>
              <input
                type="text"
                value={formData.zip}
                onChange={(e) =>
                  setFormData({ ...formData, zip: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="37214"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Display Order
              </label>
              <input
                type="number"
                value={formData.display_order}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    display_order: parseInt(e.target.value) || 0,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="0"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notification Emails (Optional)
            </label>
            <input
              type="text"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="farm@example.com, admin@example.com"
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter comma-separated email addresses to notify when trips use
              this location
            </p>
          </div>

          {/* Pickup / Drop-off Instructions */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pickup / Drop-off Instructions (Optional)
            </label>
            <textarea
              value={formData.pickup_dropoff_instructions}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  pickup_dropoff_instructions: e.target.value,
                })
              }
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
              placeholder="e.g. Pull up to the lower level departures curb. Look for the black SUV near Door 4."
            />
            <p className="text-xs text-gray-500 mt-1">
              Shown to drivers and passengers when this location is used for
              pickup or drop-off
            </p>
          </div>

          {/* Is Airport toggle */}
          <div className="mb-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_airport}
                onChange={(e) =>
                  setFormData({ ...formData, is_airport: e.target.checked })
                }
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">
                ✈️ This is an airport location
              </span>
            </label>
            <p className="text-xs text-gray-500 mt-1 ml-7">
              Marks this location as an airport so trips to/from here
              automatically show flight info fields.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
            >
              {createMutation.isPending || updateMutation.isPending
                ? "Saving..."
                : editingId
                  ? "Update Location"
                  : "Add Location"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <p className="text-gray-500">Loading locations...</p>
      ) : locations.length === 0 ? (
        <p className="text-gray-500 italic">
          No preferred locations yet. Add one above!
        </p>
      ) : (
        <div className="space-y-2">
          {locations.map((location) => (
            <div
              key={location.id}
              className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{location.emoji || "📍"}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900">
                      {location.label}
                    </p>
                    {location.is_airport && (
                      <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded-full">
                        ✈️ Airport
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">
                    {location.street}, {location.city}, {location.state}{" "}
                    {location.zip}
                  </p>
                  {location.email && (
                    <p className="text-xs text-gray-500 mt-1">
                      📧 {location.email}
                    </p>
                  )}
                  {location.pickup_dropoff_instructions && (
                    <p className="text-xs text-gray-500 mt-1 italic">
                      📋 {location.pickup_dropoff_instructions}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleEdit(location)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Edit"
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={() => handleDelete(location.id, location.label)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete"
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
