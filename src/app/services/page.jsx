"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  MoreVertical,
  XCircle,
  Clock,
  DollarSign,
  GripVertical,
  ShieldCheck,
  ShieldAlert,
  Plane,
  Pencil,
  Printer,
  Trash2,
} from "lucide-react";
import { toast } from "@/utils/notify";
import { PageWithBackButton } from "@/components/PageWithBackButton";

export default function ServicesPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [deletingService, setDeletingService] = useState(null);
  const [deleteError, setDeleteError] = useState(null); // { message, usageCount, canForce }

  const { data: services, isLoading } = useQuery({
    queryKey: ["services"],
    queryFn: async () => {
      const res = await fetch("/api/services");
      return res.json();
    },
  });

  // Shared sort: main services first then add-ons, alpha within each group,
  // but "Large SUV" and "XL SUV" always go to the end of their group.
  const sortServices = (a, b) => {
    // Main services first, then add-ons
    if (a.is_addon !== b.is_addon) {
      return a.is_addon ? 1 : -1;
    }
    // Pin "Large SUV" and "XL SUV" to the bottom of their group
    const nameA = (a.name || "").trim().toLowerCase();
    const nameB = (b.name || "").trim().toLowerCase();
    const pinnedNames = ["large suv", "xl suv"];
    const aIsPinned = pinnedNames.some((p) => nameA.includes(p));
    const bIsPinned = pinnedNames.some((p) => nameB.includes(p));
    if (aIsPinned && !bIsPinned) return 1;
    if (!aIsPinned && bIsPinned) return -1;
    // Within pinned items, "Large SUV" before "XL SUV"
    if (aIsPinned && bIsPinned) return nameA.localeCompare(nameB);
    // Otherwise alphabetical
    return a.name.localeCompare(b.name);
  };

  const printServices = () => {
    const servicesToPrint = [...(services || [])].sort(sortServices);
    const rows = servicesToPrint
      .map((service) => {
        const priceText = service.is_variable_price
          ? "Variable"
          : `$${Number(service.default_price).toFixed(2)}`;
        const tags = [];
        if (service.is_airport_service) tags.push("✈ Airport");
        if (service.is_addon) tags.push("✦ Add-on");
        if (service.is_variable_price) tags.push("Flexible Price");
        const tagText = tags.length > 0 ? tags.join(", ") : "—";
        return `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:700;color:#000;">${service.name}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:12px;font-weight:600;color:#000;">${service.description || "—"}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:700;color:#000;">${priceText}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:700;color:#000;">${service.duration_minutes} min</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:700;">${service.is_active ? '<span style="color:#16a34a;font-weight:700;">Active</span>' : '<span style="color:#6b7280;font-weight:600;">Inactive</span>'}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:12px;font-weight:600;color:#000;">${tagText}</td>
        </tr>`;
      })
      .join("");

    const html = `<!DOCTYPE html>
<html><head><title>Services List</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 32px; color: #000; }
  h1 { font-size: 22px; margin: 0 0 4px; font-weight: 800; color: #000; }
  p.sub { font-size: 13px; color: #000; margin: 0 0 20px; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; padding: 10px 12px; background: #f9fafb; border-bottom: 2px solid #000; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #000; font-weight: 700; }
  @media print { body { padding: 16px; } }
</style>
</head><body>
<h1>Services List</h1>
<p class="sub">Printed ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} &mdash; ${servicesToPrint.length} service${servicesToPrint.length !== 1 ? "s" : ""}</p>
<table>
  <thead><tr>
    <th>Service</th><th>Description</th><th>Price</th><th style="text-align:center;">Duration</th><th>Status</th><th>Tags</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>
</body></html>`;

    const printWindow =
      typeof window !== "undefined" ? window.open("", "_blank") : null;
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async ({ id, force }) => {
      const url = force
        ? `/api/services/${id}?force=true`
        : `/api/services/${id}`;
      const res = await fetch(url, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        const err = new Error(data.error || "Failed to delete");
        err.data = data;
        err.status = res.status;
        throw err;
      }
      return data;
    },
    onSuccess: () => {
      toast.success("Service deleted");
      setDeletingService(null);
      setDeleteError(null);
      queryClient.invalidateQueries(["services"]);
    },
    onError: (err) => {
      if (err.status === 409 && err.data?.canForce) {
        setDeleteError(err.data);
      } else {
        toast.error(err.message || "Could not delete service");
      }
    },
  });

  return (
    <PageWithBackButton>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
              Services
            </h1>
            <p className="text-gray-500 mt-1">
              Configure the types of transport services you offer.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={printServices}
              disabled={isLoading || !services?.length}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Printer size={18} />
              Print List
            </button>
            <button
              onClick={() => {
                setEditingService(null);
                setIsModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={18} />
              Add Service
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-10"></th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Service
                </th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Default Price
                </th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td
                    colSpan="6"
                    className="px-6 py-12 text-center text-gray-500"
                  >
                    Loading services...
                  </td>
                </tr>
              ) : services?.length === 0 ? (
                <tr>
                  <td
                    colSpan="6"
                    className="px-6 py-12 text-center text-gray-500"
                  >
                    No services found.
                  </td>
                </tr>
              ) : (
                [...services].sort(sortServices).map((service) => (
                  <tr
                    key={service.id}
                    className="hover:bg-gray-50 transition-colors group"
                  >
                    <td className="px-4 py-4 text-gray-300">
                      <GripVertical size={18} />
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                        {service.name}
                        {service.is_airport_service && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded-full border border-sky-100">
                            <Plane size={10} /> Airport
                          </span>
                        )}
                        {service.is_addon && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-full border border-purple-100">
                            ✦ Add-on
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500 line-clamp-1">
                        {service.description || "No description"}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-gray-900">
                          {service.is_variable_price
                            ? "Variable"
                            : `$${Number(service.default_price).toFixed(2)}`}
                        </span>
                        {service.is_variable_price && (
                          <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full border border-blue-100 uppercase tracking-tight">
                            Flexible
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-sm text-gray-600">
                        <Clock size={14} className="text-gray-400" />
                        {service.duration_minutes} min
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {service.is_active ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 px-2 py-1 bg-green-50 rounded-full border border-green-100">
                          <ShieldCheck size={12} /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-400 px-2 py-1 bg-gray-50 rounded-full border border-gray-100">
                          <ShieldAlert size={12} /> Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setEditingService(service);
                            setIsModalOpen(true);
                          }}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit service"
                        >
                          <Pencil size={18} />
                        </button>
                        <button
                          onClick={() => {
                            setDeletingService(service);
                          }}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete service"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {deletingService && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-50 rounded-lg">
                <Trash2 size={20} className="text-red-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Delete Service
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Are you sure you want to delete{" "}
                  <span className="font-semibold text-gray-800">
                    "{deletingService.name}"
                  </span>
                  ? This cannot be undone.
                </p>
              </div>
            </div>

            {deleteError && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                <p className="font-semibold mb-1">⚠️ Service In Use</p>
                <p>{deleteError.message}</p>
                <p className="mt-2 text-xs text-amber-700">
                  Clicking <strong>Force Delete</strong> will remove it from all
                  linked trips and then delete it permanently.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setDeletingService(null);
                  setDeleteError(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              {deleteError?.canForce ? (
                <button
                  onClick={() =>
                    deleteMutation.mutate({
                      id: deletingService.id,
                      force: true,
                    })
                  }
                  disabled={deleteMutation.isLoading}
                  className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {deleteMutation.isLoading ? "Deleting..." : "Force Delete"}
                </button>
              ) : (
                <button
                  onClick={() =>
                    deleteMutation.mutate({
                      id: deletingService.id,
                      force: false,
                    })
                  }
                  disabled={deleteMutation.isLoading}
                  className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {deleteMutation.isLoading ? "Deleting..." : "Delete"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <ServiceModal
          service={editingService}
          onClose={() => {
            setIsModalOpen(false);
            setEditingService(null);
          }}
          onSuccess={() => {
            setIsModalOpen(false);
            setEditingService(null);
            queryClient.invalidateQueries(["services"]);
          }}
        />
      )}
    </PageWithBackButton>
  );
}

function ServiceModal({ service, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    name: service?.name || "",
    description: service?.description || "",
    default_price: service?.default_price || 0,
    duration_minutes: service?.duration_minutes || 75,
    is_variable_price: service?.is_variable_price || false,
    display_order: service?.display_order || 0,
    is_active: service?.is_active ?? true,
    is_airport_service: service?.is_airport_service || false,
    is_addon: service?.is_addon || false,
    can_passenger_request: service?.can_passenger_request || false,
    is_tip_addon: service?.is_tip_addon || false,
  });

  const mutation = useMutation({
    mutationFn: async (data) => {
      const url = service ? `/api/services/${service.id}` : "/api/services";
      const method = service ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      toast.success(service ? "Service updated" : "Service added");
      onSuccess();
    },
  });

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between shrink-0">
          <h2 className="text-xl font-semibold text-gray-900">
            {service ? "Edit Service" : "New Service"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <XCircle size={24} />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Service Name
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="e.g. Airport Transfer"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Description
            </label>
            <textarea
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 min-h-[80px]"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Detailed description of the service..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Default Price ($)
              </label>
              <input
                type="number"
                step="0.01"
                disabled={formData.is_variable_price}
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 disabled:bg-gray-50 disabled:text-gray-400"
                value={formData.default_price}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    default_price: Number(e.target.value),
                  })
                }
              />
              <p className="text-[11px] text-gray-400">
                $ — Starting price charged for this service
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Duration (min)
              </label>
              <input
                type="number"
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
                value={formData.duration_minutes}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    duration_minutes: Number(e.target.value),
                  })
                }
              />
              <p className="text-[11px] text-gray-400">
                ⏱ How long this service takes in minutes
              </p>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Display Order
            </label>
            <input
              type="number"
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
              value={formData.display_order}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  display_order: Number(e.target.value),
                })
              }
            />
            <p className="text-[11px] text-gray-400">
              # — Lower numbers appear first in booking lists (e.g. 1 = top)
            </p>
          </div>
          <div className="flex flex-col gap-2 pt-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="airport_service"
                checked={formData.is_airport_service}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    is_airport_service: e.target.checked,
                  })
                }
                className="w-4 h-4 text-sky-600 border-gray-300 rounded focus:ring-sky-600"
              />
              <label
                htmlFor="airport_service"
                className="text-sm font-medium text-gray-700 cursor-pointer text-xs flex items-center gap-1"
              >
                <Plane size={12} className="text-sky-500" />
                Airport service (shows flight info on bookings)
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_addon"
                checked={formData.is_addon}
                onChange={(e) =>
                  setFormData({ ...formData, is_addon: e.target.checked })
                }
                className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-600"
              />
              <label
                htmlFor="is_addon"
                className="text-sm font-medium text-gray-700 cursor-pointer text-xs flex items-center gap-1"
              >
                ✦ Add-on (shown as an extra on trips, not a main service)
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="can_passenger_request"
                checked={formData.can_passenger_request}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    can_passenger_request: e.target.checked,
                  })
                }
                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-600"
              />
              <label
                htmlFor="can_passenger_request"
                className="text-sm font-medium text-gray-700 cursor-pointer text-xs flex items-center gap-1"
              >
                🌐 Passengers can request this in online booking
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_tip_addon"
                checked={formData.is_tip_addon}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    is_tip_addon: e.target.checked,
                  })
                }
                className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-600"
              />
              <label
                htmlFor="is_tip_addon"
                className="text-sm font-medium text-gray-700 cursor-pointer text-xs flex items-center gap-1"
              >
                💵 Counts as driver reimbursement (added to compensation - same
                as tip - but not as a tip)
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="variable"
                checked={formData.is_variable_price}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    is_variable_price: e.target.checked,
                  })
                }
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-600"
              />
              <label
                htmlFor="variable"
                className="text-sm font-medium text-gray-700 cursor-pointer text-xs"
              >
                Variable pricing (set price per trip)
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="active_s"
                checked={formData.is_active}
                onChange={(e) =>
                  setFormData({ ...formData, is_active: e.target.checked })
                }
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-600"
              />
              <label
                htmlFor="active_s"
                className="text-sm font-medium text-gray-700 cursor-pointer text-xs"
              >
                Active and available for booking
              </label>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate(formData)}
            disabled={mutation.isLoading || !formData.name}
            className="px-6 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {mutation.isLoading
              ? "Saving..."
              : service
                ? "Update Service"
                : "Add Service"}
          </button>
        </div>
      </div>
    </div>
  );
}
