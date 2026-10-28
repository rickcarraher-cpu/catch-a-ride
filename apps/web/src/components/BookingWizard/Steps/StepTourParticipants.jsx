import { useState } from "react";
import { Plus, Trash2, User, MapPin, UserCheck } from "lucide-react";

export function StepTourParticipants({ formData, set, clients = [] }) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [currentGuest, setCurrentGuest] = useState({
    name: "",
    pickup_location: "",
    dropoff_location: "",
  });

  const maxGuests = 7;
  const guests = formData.tour_participants || [];
  const currentGuestCount = guests.length;

  const handleAdd = () => {
    if (!currentGuest.name.trim()) {
      alert("Guest name is required");
      return;
    }

    if (editingIndex !== null) {
      // Update existing guest
      const updatedGuests = [...guests];
      updatedGuests[editingIndex] = currentGuest;
      set({ tour_participants: updatedGuests });
      setEditingIndex(null);
    } else {
      // Add new guest
      set({ tour_participants: [...guests, currentGuest] });
    }

    // Reset form
    setCurrentGuest({
      name: "",
      pickup_location: "",
      dropoff_location: "",
    });
    setShowAddForm(false);
  };

  const handleEdit = (index) => {
    setCurrentGuest(guests[index]);
    setEditingIndex(index);
    setShowAddForm(true);
  };

  const handleDelete = (index) => {
    set({ tour_participants: guests.filter((_, i) => i !== index) });
  };

  const handleCancel = () => {
    setCurrentGuest({
      name: "",
      pickup_location: "",
      dropoff_location: "",
    });
    setEditingIndex(null);
    setShowAddForm(false);
  };

  return (
    <>
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Tour Participants</h2>
        <p className="text-sm text-gray-500 mt-1">
          Primary passenger + up to {maxGuests} additional guests
        </p>
      </div>

      {/* Primary Passenger (read-only, from Step 1) */}
      <div className="bg-purple-50 border-2 border-purple-300 rounded-2xl p-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-purple-600 flex items-center justify-center shrink-0">
            <UserCheck size={24} className="text-white" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <p className="font-bold text-lg text-purple-900">
                {formData.name || "Primary Passenger"}
              </p>
              <span className="px-2 py-0.5 bg-purple-600 text-white text-xs font-bold rounded-full">
                PRIMARY
              </span>
            </div>
            {formData.phone && (
              <p className="text-sm text-purple-800">📱 {formData.phone}</p>
            )}
            {formData.email && (
              <p className="text-sm text-purple-800">✉️ {formData.email}</p>
            )}
            <p className="text-xs text-purple-700 mt-2 font-semibold">
              ✓ Will receive all booking confirmations and updates
            </p>
          </div>
        </div>
      </div>

      {/* Additional Guests List */}
      {currentGuestCount > 0 && (
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-3">
            Additional Guests ({currentGuestCount}/{maxGuests})
          </p>
          <div className="space-y-2">
            {guests.map((guest, index) => (
              <div
                key={index}
                className="p-4 bg-gray-50 border border-gray-200 rounded-2xl"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <User size={16} className="text-gray-400" />
                      <p className="font-bold text-gray-900">{guest.name}</p>
                    </div>
                    {guest.pickup_location && (
                      <p className="text-sm text-gray-600 mt-2">
                        🟢 Pickup: {guest.pickup_location}
                      </p>
                    )}
                    {guest.dropoff_location && (
                      <p className="text-sm text-gray-600">
                        🔴 Drop-off: {guest.dropoff_location}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleEdit(index)}
                      className="px-3 py-1 text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-all"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(index)}
                      className="px-3 py-1 text-sm bg-red-100 hover:bg-red-200 text-red-700 rounded-lg flex items-center gap-1 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Guest Button */}
      {!showAddForm && currentGuestCount < maxGuests && (
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="w-full p-4 border-2 border-dashed border-gray-300 hover:border-purple-500 hover:bg-purple-50 rounded-2xl transition-all flex items-center justify-center gap-2 text-gray-600 hover:text-purple-700 font-semibold"
        >
          <Plus size={20} />
          Add Guest{" "}
          {currentGuestCount > 0 &&
            `(${maxGuests - currentGuestCount} remaining)`}
        </button>
      )}

      {/* Add/Edit Guest Form */}
      {showAddForm && (
        <div className="p-6 bg-purple-50 border-2 border-purple-200 rounded-2xl space-y-4">
          <h3 className="font-bold text-lg text-purple-900">
            {editingIndex !== null ? "Edit" : "Add"} Guest
          </h3>

          {/* Name */}
          <div>
            <label className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-2">
              <User size={16} className="text-gray-400" />
              Guest Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={currentGuest.name}
              onChange={(e) =>
                setCurrentGuest({
                  ...currentGuest,
                  name: e.target.value,
                })
              }
              placeholder="Full name"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none"
            />
          </div>

          {/* Pickup location */}
          <div>
            <label className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-2">
              <MapPin size={16} className="text-green-600" />
              Pickup Location (Optional)
            </label>
            <input
              type="text"
              value={currentGuest.pickup_location}
              onChange={(e) =>
                setCurrentGuest({
                  ...currentGuest,
                  pickup_location: e.target.value,
                })
              }
              placeholder="123 Main St, City, State"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none"
            />
          </div>

          {/* Drop-off location */}
          <div>
            <label className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-2">
              <MapPin size={16} className="text-red-600" />
              Drop-off Location (Optional)
            </label>
            <input
              type="text"
              value={currentGuest.dropoff_location}
              onChange={(e) =>
                setCurrentGuest({
                  ...currentGuest,
                  dropoff_location: e.target.value,
                })
              }
              placeholder="456 Oak Ave, City, State"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none"
            />
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleAdd}
              className="flex-1 px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-all"
            >
              {editingIndex !== null ? "Update" : "Add"} Guest
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-xl transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Info note */}
      {currentGuestCount === 0 && !showAddForm && (
        <div className="bg-blue-50 border border-blue-300 rounded-2xl p-4">
          <p className="text-sm text-blue-800">
            ℹ️ You can add up to {maxGuests} additional guests. Guests are
            optional — the primary passenger is already set.
          </p>
        </div>
      )}

      {/* Max capacity warning */}
      {currentGuestCount >= maxGuests && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4">
          <p className="text-sm text-amber-800">
            ⚠️ Maximum of {maxGuests} additional guests reached. You can edit or
            remove existing guests to make changes.
          </p>
        </div>
      )}
    </>
  );
}
