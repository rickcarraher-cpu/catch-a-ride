import { useState } from "react";
import { Plus, Trash2, GripVertical, MapPin, FileText } from "lucide-react";

export function StepTourItinerary({ formData, set }) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [currentStop, setCurrentStop] = useState({
    location: "",
    description: "",
  });

  const itinerary = formData.tour_itinerary || [];

  const handleAdd = () => {
    if (!currentStop.location.trim()) {
      alert("Location is required");
      return;
    }

    if (editingIndex !== null) {
      // Update existing
      const updated = [...itinerary];
      updated[editingIndex] = {
        ...currentStop,
        sequence_order: editingIndex + 1,
      };
      set({ tour_itinerary: updated });
      setEditingIndex(null);
    } else {
      // Add new
      set({
        tour_itinerary: [
          ...itinerary,
          { ...currentStop, sequence_order: itinerary.length + 1 },
        ],
      });
    }

    // Reset form
    setCurrentStop({ location: "", description: "" });
    setShowAddForm(false);
  };

  const handleEdit = (index) => {
    setCurrentStop(itinerary[index]);
    setEditingIndex(index);
    setShowAddForm(true);
  };

  const handleDelete = (index) => {
    const updated = itinerary.filter((_, i) => i !== index);
    // Resequence
    const resequenced = updated.map((stop, i) => ({
      ...stop,
      sequence_order: i + 1,
    }));
    set({ tour_itinerary: resequenced });
  };

  const handleMoveUp = (index) => {
    if (index === 0) return;
    const updated = [...itinerary];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    // Resequence
    const resequenced = updated.map((stop, i) => ({
      ...stop,
      sequence_order: i + 1,
    }));
    set({ tour_itinerary: resequenced });
  };

  const handleMoveDown = (index) => {
    if (index === itinerary.length - 1) return;
    const updated = [...itinerary];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    // Resequence
    const resequenced = updated.map((stop, i) => ({
      ...stop,
      sequence_order: i + 1,
    }));
    set({ tour_itinerary: resequenced });
  };

  const handleCancel = () => {
    setCurrentStop({ location: "", description: "" });
    setEditingIndex(null);
    setShowAddForm(false);
  };

  return (
    <>
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Tour Itinerary</h2>
        <p className="text-sm text-gray-500 mt-1">
          Define the stops and route for this tour (in sequential order)
        </p>
      </div>

      {/* Free-form itinerary notes */}
      <div className="p-4 bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-200 rounded-2xl space-y-2">
        <label className="text-sm font-semibold text-purple-900 flex items-center gap-2">
          <FileText size={16} className="text-purple-600" />
          Itinerary Notes{" "}
          <span className="text-xs text-purple-600 font-normal">
            (free-form)
          </span>
        </label>
        <textarea
          value={formData.tour_notes || ""}
          onChange={(e) => set({ tour_notes: e.target.value })}
          placeholder="e.g. Pick up at hotel at 9am → Broadway for lunch → Music Row → Honky Tonk Highway → Back by 5pm. Any special requests or details..."
          rows={4}
          className="w-full px-4 py-3 bg-white border-2 border-purple-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none resize-none text-sm"
        />
        <p className="text-xs text-purple-600">
          Describe the tour route, timing, and any special notes in your own
          words. Use the stops below for structured tracking.
        </p>
      </div>

      {/* List of itinerary stops */}
      {itinerary.length > 0 && (
        <div className="space-y-2">
          {itinerary.map((stop, index) => (
            <div
              key={index}
              className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-200 rounded-2xl"
            >
              <div className="flex items-start gap-3">
                {/* Sequence number */}
                <div className="flex flex-col items-center gap-1">
                  <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold text-sm">
                    {index + 1}
                  </div>
                  {/* Move up/down buttons */}
                  <div className="flex flex-col gap-1">
                    {index > 0 && (
                      <button
                        type="button"
                        onClick={() => handleMoveUp(index)}
                        className="p-1 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded"
                        title="Move up"
                      >
                        ↑
                      </button>
                    )}
                    {index < itinerary.length - 1 && (
                      <button
                        type="button"
                        onClick={() => handleMoveDown(index)}
                        className="p-1 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded"
                        title="Move down"
                      >
                        ↓
                      </button>
                    )}
                  </div>
                </div>

                {/* Stop details */}
                <div className="flex-1">
                  <p className="font-bold text-gray-900 flex items-center gap-2">
                    <MapPin size={16} className="text-purple-600" />
                    {stop.location}
                  </p>
                  {stop.description && (
                    <p className="text-sm text-gray-600 mt-1 flex items-start gap-2">
                      <FileText size={14} className="text-gray-400 mt-0.5" />
                      {stop.description}
                    </p>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleEdit(index)}
                    className="px-3 py-1 text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(index)}
                    className="px-3 py-1 text-sm bg-red-100 hover:bg-red-200 text-red-700 rounded-lg flex items-center gap-1"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add button */}
      {!showAddForm && (
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="w-full p-4 border-2 border-dashed border-gray-300 hover:border-purple-500 hover:bg-purple-50 rounded-2xl transition-all flex items-center justify-center gap-2 text-gray-600 hover:text-purple-700 font-semibold"
        >
          <Plus size={20} />
          Add Stop
        </button>
      )}

      {/* Add/Edit form */}
      {showAddForm && (
        <div className="p-6 bg-purple-50 border-2 border-purple-200 rounded-2xl space-y-4">
          <h3 className="font-bold text-lg text-purple-900">
            {editingIndex !== null ? "Edit" : "Add"} Stop
          </h3>

          {/* Location */}
          <div>
            <label className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-2">
              <MapPin size={16} className="text-purple-600" />
              Location <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={currentStop.location}
              onChange={(e) =>
                setCurrentStop({ ...currentStop, location: e.target.value })
              }
              placeholder="e.g., Downtown Nashville, Broadway District, Music Row"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-2">
              <FileText size={16} className="text-gray-400" />
              Description (Optional)
            </label>
            <textarea
              value={currentStop.description}
              onChange={(e) =>
                setCurrentStop({ ...currentStop, description: e.target.value })
              }
              placeholder="e.g., Stop for photos, lunch break, shopping, etc."
              rows={3}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none resize-none"
            />
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleAdd}
              className="flex-1 px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-all"
            >
              {editingIndex !== null ? "Update" : "Add"} Stop
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
      <div className="bg-purple-50 border-2 border-purple-200 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center shrink-0">
            <span className="text-white text-xl">ℹ️</span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-purple-900 mb-1">
              Tour Itinerary
            </p>
            <p className="text-sm text-purple-800 leading-relaxed">
              Define the sequential route for this tour. You can add multiple
              stops, reorder them using the arrow buttons, and include
              descriptions for each location. The destination field is used for
              logistics only and won't affect pricing.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
