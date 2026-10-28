import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/utils/notify";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  GripVertical,
  Tag,
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

export function ExpenseCategoriesSection() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [formData, setFormData] = useState({ name: "" });

  // CSV import state
  const [showCsvPanel, setShowCsvPanel] = useState(false);
  const [csvParsed, setCsvParsed] = useState(null);
  const [csvFileName, setCsvFileName] = useState("");
  const fileInputRef = useRef(null);

  // Fetch categories
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["expense-categories"],
    queryFn: async () => {
      const res = await fetch("/api/settings/expense-categories");
      if (!res.ok) throw new Error("Failed to fetch categories");
      return res.json();
    },
  });

  // Save mutation (updates entire array)
  const saveMutation = useMutation({
    mutationFn: async (updatedCategories) => {
      const res = await fetch("/api/settings/expense-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categories: updatedCategories }),
      });
      if (!res.ok) throw new Error("Failed to save categories");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expense-categories"] });
      toast.success("Expense categories updated");
      resetForm();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setFormData({ name: "" });
    setShowForm(false);
    setEditingIndex(null);
  };

  const handleEdit = (category, index) => {
    setFormData({ name: category.name });
    setEditingIndex(index);
    setShowForm(true);
    setShowCsvPanel(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Category name is required");
      return;
    }

    let updatedCategories = [...categories];

    if (editingIndex !== null) {
      // Update existing
      updatedCategories[editingIndex] = {
        ...updatedCategories[editingIndex],
        name: formData.name.trim(),
      };
    } else {
      // Add new
      updatedCategories.push({
        name: formData.name.trim(),
        display_order: updatedCategories.length,
      });
    }

    saveMutation.mutate(updatedCategories);
  };

  const handleDelete = (index) => {
    const category = categories[index];
    if (!confirm(`Delete "${category.name}" category?`)) return;

    const updatedCategories = categories
      .filter((_, i) => i !== index)
      .map((cat, i) => ({ ...cat, display_order: i }));

    saveMutation.mutate(updatedCategories);
  };

  const moveCategory = (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= categories.length) return;

    const updatedCategories = [...categories];
    const [moved] = updatedCategories.splice(fromIndex, 1);
    updatedCategories.splice(toIndex, 0, moved);

    // Update display_order
    const reordered = updatedCategories.map((cat, i) => ({
      ...cat,
      display_order: i,
    }));

    saveMutation.mutate(reordered);
  };

  // --- CSV helpers ---
  const handleCsvFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".csv")) {
      toast.error("Please select a .csv file");
      return;
    }
    setCsvFileName(file.name);
    file
      .text()
      .then((text) => {
        const lines = text
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean);
        if (lines.length === 0) {
          toast.error("CSV file is empty");
          return;
        }
        const firstLine = lines[0].replace(/^"|"$/g, "").toLowerCase();
        const startIdx = firstLine === "name" ? 1 : 0;
        const names = lines
          .slice(startIdx)
          .map((l) => l.replace(/^"|"$/g, "").trim())
          .filter(Boolean);
        if (names.length === 0) {
          toast.error("No category names found in CSV");
          return;
        }
        setCsvParsed(names);
      })
      .catch(() => toast.error("Could not read file"));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDownloadTemplate = () => {
    if (typeof window === "undefined") return;
    const csv = "name\nFuel\nMaintenance\nInsurance\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "expense-categories-template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Template downloaded!");
  };

  const existingNames = new Set(categories.map((c) => c.name.toLowerCase()));
  const newFromCsv = csvParsed
    ? csvParsed.filter((n) => !existingNames.has(n.toLowerCase()))
    : [];
  const duplicatesFromCsv = csvParsed
    ? csvParsed.filter((n) => existingNames.has(n.toLowerCase()))
    : [];

  const csvFileLabelText = csvFileName
    ? csvFileName
    : "Click to select a .csv file";
  const importButtonLabel = saveMutation.isPending
    ? "Importing..."
    : `Import ${newFromCsv.length} Categories`;

  const handleImportCsv = () => {
    if (!newFromCsv.length) {
      toast.error("No new categories to import");
      return;
    }
    const merged = [
      ...categories,
      ...newFromCsv.map((name, i) => ({
        name,
        display_order: categories.length + i,
      })),
    ];
    saveMutation.mutate(merged);
    setCsvParsed(null);
    setCsvFileName("");
    setShowCsvPanel(false);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Tag size={20} className="text-blue-600" />
            Expense Categories
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Manage your chart of accounts for expense tracking
          </p>
        </div>
        {!showForm && !showCsvPanel && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCsvPanel(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Upload size={16} />
              Import CSV
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={18} />
              Add Category
            </button>
          </div>
        )}
      </div>

      {/* CSV import panel */}
      {showCsvPanel && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-gray-900 flex items-center gap-2">
              <Upload size={16} className="text-blue-600" />
              Import from CSV
            </h4>
            <button
              type="button"
              onClick={() => {
                setShowCsvPanel(false);
                setCsvParsed(null);
                setCsvFileName("");
              }}
              className="p-1 text-gray-400 hover:text-gray-600 rounded"
            >
              <X size={20} />
            </button>
          </div>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
            <FileText size={14} className="text-blue-600 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-700">
              <strong>CSV format:</strong> One category name per row. Optional
              header row: <code className="bg-blue-100 px-1 rounded">name</code>
              . Duplicates are automatically skipped.
            </p>
          </div>

          <label
            htmlFor="expense-cat-csv"
            className="flex flex-col items-center justify-center gap-2 p-5 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
          >
            <Upload size={22} className="text-gray-400" />
            <span className="text-sm font-medium text-gray-700">
              {csvFileName ? csvFileName : "Click to select a .csv file"}
            </span>
            {!csvFileName && (
              <span className="text-xs text-gray-400">
                One category name per row
              </span>
            )}
            <input
              ref={fileInputRef}
              id="expense-cat-csv"
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleCsvFile}
            />
          </label>

          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 underline"
          >
            <FileText size={13} />
            Download example template
          </button>

          {/* Preview parsed results */}
          {csvParsed && (
            <div className="space-y-3">
              <div className="flex gap-4 text-sm">
                <span className="text-green-700 font-medium flex items-center gap-1">
                  <CheckCircle2 size={14} />
                  {newFromCsv.length} new to add
                </span>
                {duplicatesFromCsv.length > 0 && (
                  <span className="text-amber-600 font-medium flex items-center gap-1">
                    <AlertCircle size={14} />
                    {duplicatesFromCsv.length} already exist (skipped)
                  </span>
                )}
              </div>

              {newFromCsv.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg p-3 max-h-40 overflow-y-auto space-y-1">
                  {newFromCsv.map((name, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-sm text-gray-700"
                    >
                      <CheckCircle2
                        size={13}
                        className="text-green-500 shrink-0"
                      />
                      {name}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCsvParsed(null);
                    setCsvFileName("");
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={handleImportCsv}
                  disabled={newFromCsv.length === 0 || saveMutation.isPending}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {importButtonLabel}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200"
        >
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-gray-900">
              {editingIndex !== null ? "Edit Category" : "Add New Category"}
            </h4>
            <button
              type="button"
              onClick={resetForm}
              className="p-1 text-gray-400 hover:text-gray-600 rounded"
            >
              <X size={20} />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ name: e.target.value })}
                placeholder="e.g., Vehicle Repairs, Software Subscriptions"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saveMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saveMutation.isPending
                  ? "Saving..."
                  : editingIndex !== null
                    ? "Update"
                    : "Add Category"}
              </button>
            </div>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="text-center py-8 text-gray-500">
          Loading categories...
        </div>
      ) : categories.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Tag size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">No expense categories configured</p>
          <p className="text-xs mt-1">Add your first category to get started</p>
        </div>
      ) : (
        <div className="space-y-2">
          {categories.map((category, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors group"
            >
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => moveCategory(index, index - 1)}
                  disabled={index === 0}
                  className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Move up"
                >
                  <GripVertical size={14} />
                </button>
                <button
                  onClick={() => moveCategory(index, index + 1)}
                  disabled={index === categories.length - 1}
                  className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Move down"
                >
                  <GripVertical size={14} />
                </button>
              </div>

              <div className="flex-1">
                <p className="font-medium text-gray-900">{category.name}</p>
                <p className="text-xs text-gray-500">
                  Order: {category.display_order + 1}
                </p>
              </div>

              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleEdit(category, index)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Edit"
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={() => handleDelete(index)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete"
                  disabled={saveMutation.isPending}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-xs text-yellow-800">
          <strong>Note:</strong> Existing expense records will keep their
          original category names. Only new expenses will use these updated
          categories.
        </p>
      </div>
    </div>
  );
}
