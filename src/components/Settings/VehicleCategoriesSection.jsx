"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, Plus, GripVertical, Edit2, Check, X } from "lucide-react";

export default function VehicleCategoriesSection() {
  const queryClient = useQueryClient();
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["vehicle-categories"],
    queryFn: async () => {
      const response = await fetch("/api/vehicle-categories");
      if (!response.ok) throw new Error("Failed to fetch categories");
      return response.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (name) => {
      const response = await fetch("/api/vehicle-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          display_order: (data?.categories?.length || 0) + 1,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create category");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["vehicle-categories"]);
      setNewCategoryName("");
      setShowAddForm(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, name }) => {
      const response = await fetch(`/api/vehicle-categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update category");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["vehicle-categories"]);
      setEditingId(null);
      setEditingName("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const response = await fetch(`/api/vehicle-categories/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete category");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["vehicle-categories"]);
    },
  });

  const handleCreate = (e) => {
    e.preventDefault();
    if (newCategoryName.trim()) {
      createMutation.mutate(newCategoryName.trim());
    }
  };

  const handleUpdate = (id) => {
    if (editingName.trim()) {
      updateMutation.mutate({ id, name: editingName.trim() });
    }
  };

  const handleDelete = (id, name) => {
    if (
      confirm(
        `Delete category "${name}"? This will fail if any vehicles use this category.`,
      )
    ) {
      deleteMutation.mutate(id);
    }
  };

  const startEditing = (category) => {
    setEditingId(category.id);
    setEditingName(category.name);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingName("");
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Vehicle Categories</h2>
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold">Vehicle Categories</h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage vehicle types available for booking
          </p>
        </div>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus size={20} />
            Add Category
          </button>
        )}
      </div>

      {showAddForm && (
        <form
          onSubmit={handleCreate}
          className="mb-6 p-4 bg-gray-50 rounded-lg"
        >
          <div className="flex gap-2">
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="New category name"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
              autoFocus
            />
            <button
              type="submit"
              disabled={createMutation.isPending || !newCategoryName.trim()}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {createMutation.isPending ? "Adding..." : "Add"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setNewCategoryName("");
              }}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
          {createMutation.isError && (
            <p className="text-red-600 text-sm mt-2">
              {createMutation.error.message}
            </p>
          )}
        </form>
      )}

      <div className="space-y-2">
        {data?.categories?.map((category) => (
          <div
            key={category.id}
            className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
          >
            <GripVertical size={20} className="text-gray-400" />

            {editingId === category.id ? (
              <>
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  className="flex-1 px-3 py-1 border border-gray-300 rounded"
                  autoFocus
                />
                <button
                  onClick={() => handleUpdate(category.id)}
                  disabled={updateMutation.isPending}
                  className="p-2 text-green-600 hover:bg-green-100 rounded"
                  title="Save"
                >
                  <Check size={18} />
                </button>
                <button
                  onClick={cancelEditing}
                  className="p-2 text-gray-600 hover:bg-gray-200 rounded"
                  title="Cancel"
                >
                  <X size={18} />
                </button>
              </>
            ) : (
              <>
                <span className="flex-1 font-medium">{category.name}</span>
                <button
                  onClick={() => startEditing(category)}
                  className="p-2 text-blue-600 hover:bg-blue-100 rounded"
                  title="Edit"
                >
                  <Edit2 size={18} />
                </button>
                <button
                  onClick={() => handleDelete(category.id, category.name)}
                  disabled={deleteMutation.isPending}
                  className="p-2 text-red-600 hover:bg-red-100 rounded"
                  title="Delete"
                >
                  <Trash2 size={18} />
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      {updateMutation.isError && (
        <p className="text-red-600 text-sm mt-4">
          {updateMutation.error.message}
        </p>
      )}
      {deleteMutation.isError && (
        <p className="text-red-600 text-sm mt-4">
          {deleteMutation.error.message}
        </p>
      )}

      {data?.categories?.length === 0 && !showAddForm && (
        <p className="text-gray-500 text-center py-8">
          No categories yet. Click "Add Category" to create one.
        </p>
      )}
    </div>
  );
}
