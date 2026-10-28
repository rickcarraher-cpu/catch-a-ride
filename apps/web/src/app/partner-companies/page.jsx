"use client";

import React, { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "@/utils/notify";
import {
  Building2,
  Plus,
  Edit3,
  Trash2,
  X,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";

export default function PartnerCompaniesPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    logo_url: "",
    billing_email: "",
    billing_phone: "",
    billing_address: "",
    status: "active",
    notes: "",
  });

  // Fetch partner companies
  const { data: companiesData, isLoading } = useQuery({
    queryKey: ["partner-companies"],
    queryFn: async () => {
      const res = await fetch("/api/partner-companies");
      if (!res.ok) throw new Error("Failed to fetch partner companies");
      return res.json();
    },
  });

  const companies = companiesData?.companies || [];

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data) => {
      const res = await fetch("/api/partner-companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create partner company");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Partner company created successfully");
      queryClient.invalidateQueries(["partner-companies"]);
      handleCloseModal();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const res = await fetch(`/api/partner-companies/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update partner company");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Partner company updated successfully");
      queryClient.invalidateQueries(["partner-companies"]);
      handleCloseModal();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const res = await fetch(`/api/partner-companies/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete partner company");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Partner company deleted successfully");
      queryClient.invalidateQueries(["partner-companies"]);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleOpenModal = (company = null) => {
    if (company) {
      setEditingCompany(company);
      setFormData({
        name: company.name || "",
        logo_url: company.logo_url || "",
        billing_email: company.billing_email || "",
        billing_phone: company.billing_phone || "",
        billing_address: company.billing_address || "",
        status: company.status || "active",
        notes: company.notes || "",
      });
    } else {
      setEditingCompany(null);
      setFormData({
        name: "",
        logo_url: "",
        billing_email: "",
        billing_phone: "",
        billing_address: "",
        status: "active",
        notes: "",
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingCompany(null);
    setFormData({
      name: "",
      logo_url: "",
      billing_email: "",
      billing_phone: "",
      billing_address: "",
      status: "active",
      notes: "",
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Partner company name is required");
      return;
    }

    if (editingCompany) {
      updateMutation.mutate({ id: editingCompany.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (company) => {
    if (
      window.confirm(
        `Are you sure you want to delete ${company.name}? This action cannot be undone.`,
      )
    ) {
      deleteMutation.mutate(company.id);
    }
  };

  const activeCompanies = companies.filter((c) => c.status === "active");
  const inactiveCompanies = companies.filter((c) => c.status === "inactive");

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Back Button */}
        <a
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors mb-6"
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </a>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center">
              <Building2 size={24} className="text-teal-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Partner Companies
              </h1>
              <p className="text-sm text-gray-500">
                Manage third-party companies we operate trips for
              </p>
            </div>
          </div>
          <button
            onClick={() => handleOpenModal()}
            className="px-4 py-2.5 bg-teal-600 text-white text-sm font-semibold rounded-lg hover:bg-teal-700 transition-colors flex items-center gap-2 shadow"
          >
            <Plus size={16} />
            Add Partner Company
          </button>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div
              className="h-12 w-12 border-4 border-teal-600 border-r-transparent rounded-full"
              style={{ animation: "spin 1s linear infinite" }}
            />
            <style jsx>{`
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        )}

        {/* Active Companies */}
        {!isLoading && activeCompanies.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <CheckCircle size={18} className="text-green-600" />
              Active Partners ({activeCompanies.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeCompanies.map((company) => (
                <CompanyCard
                  key={company.id}
                  company={company}
                  onEdit={() => handleOpenModal(company)}
                  onDelete={() => handleDelete(company)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Inactive Companies */}
        {!isLoading && inactiveCompanies.length > 0 && (
          <div>
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <AlertCircle size={18} className="text-gray-400" />
              Inactive Partners ({inactiveCompanies.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {inactiveCompanies.map((company) => (
                <CompanyCard
                  key={company.id}
                  company={company}
                  onEdit={() => handleOpenModal(company)}
                  onDelete={() => handleDelete(company)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && companies.length === 0 && (
          <div className="text-center py-20 bg-white rounded-xl border-2 border-dashed border-gray-200">
            <Building2 size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              No Partner Companies Yet
            </h3>
            <p className="text-gray-500 mb-6">
              Add your first partner company to start managing third-party
              drives
            </p>
            <button
              onClick={() => handleOpenModal()}
              className="px-4 py-2 bg-teal-600 text-white text-sm font-semibold rounded-lg hover:bg-teal-700 transition-colors inline-flex items-center gap-2"
            >
              <Plus size={16} />
              Add Partner Company
            </button>
          </div>
        )}

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
              {/* Modal Header */}
              <div className="px-6 py-4 bg-teal-50 border-b border-teal-100 flex items-center justify-between shrink-0">
                <h2 className="text-lg font-bold text-teal-900">
                  {editingCompany
                    ? "Edit Partner Company"
                    : "Add Partner Company"}
                </h2>
                <button
                  onClick={handleCloseModal}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body */}
              <form
                onSubmit={handleSubmit}
                className="flex-1 overflow-y-auto px-6 py-6 space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Company Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) =>
                      setFormData((f) => ({ ...f, name: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-400 focus:border-transparent"
                    placeholder="Partner Company Name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Logo URL
                  </label>
                  <input
                    type="url"
                    value={formData.logo_url}
                    onChange={(e) =>
                      setFormData((f) => ({ ...f, logo_url: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-400 focus:border-transparent"
                    placeholder="https://example.com/logo.png"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Logo to display on invoices and receipts
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Billing Email
                    </label>
                    <input
                      type="email"
                      value={formData.billing_email}
                      onChange={(e) =>
                        setFormData((f) => ({
                          ...f,
                          billing_email: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-400 focus:border-transparent"
                      placeholder="billing@partner.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Billing Phone
                    </label>
                    <input
                      type="tel"
                      value={formData.billing_phone}
                      onChange={(e) =>
                        setFormData((f) => ({
                          ...f,
                          billing_phone: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-400 focus:border-transparent"
                      placeholder="(555) 123-4567"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Billing Address
                  </label>
                  <textarea
                    value={formData.billing_address}
                    onChange={(e) =>
                      setFormData((f) => ({
                        ...f,
                        billing_address: e.target.value,
                      }))
                    }
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-400 focus:border-transparent resize-none"
                    placeholder="123 Main St, City, State ZIP"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) =>
                      setFormData((f) => ({ ...f, status: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-400 focus:border-transparent"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Internal Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData((f) => ({ ...f, notes: e.target.value }))
                    }
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-400 focus:border-transparent resize-none"
                    placeholder="Internal notes about this partner..."
                  />
                </div>
              </form>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 shrink-0 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={
                    createMutation.isPending || updateMutation.isPending
                  }
                  className="px-4 py-2 bg-teal-600 text-white text-sm font-semibold rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? "Saving..."
                    : editingCompany
                      ? "Update Company"
                      : "Create Company"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CompanyCard({ company, onEdit, onDelete }) {
  return (
    <div className="bg-white border-2 border-gray-200 rounded-xl p-4 hover:border-teal-300 hover:shadow-lg transition-all">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 text-base truncate">
            {company.name}
          </h3>
          <span
            className={`inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
              company.status === "active"
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {company.status}
          </span>
        </div>
        {company.logo_url && (
          <img
            src={company.logo_url}
            alt={`${company.name} logo`}
            className="w-12 h-12 object-contain rounded"
          />
        )}
      </div>

      <div className="space-y-1.5 text-sm text-gray-600 mb-4">
        {company.billing_email && (
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400">📧</span>
            <span className="truncate">{company.billing_email}</span>
          </div>
        )}
        {company.billing_phone && (
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400">📞</span>
            <span>{company.billing_phone}</span>
          </div>
        )}
        {company.billing_address && (
          <div className="flex items-start gap-1.5">
            <span className="text-gray-400 mt-0.5">📍</span>
            <span className="line-clamp-2 text-xs">
              {company.billing_address}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
        <button
          onClick={onEdit}
          className="flex-1 px-3 py-1.5 bg-teal-50 text-teal-700 text-xs font-semibold rounded-lg hover:bg-teal-100 transition-colors flex items-center justify-center gap-1.5"
        >
          <Edit3 size={13} />
          Edit
        </button>
        <button
          onClick={onDelete}
          className="flex-1 px-3 py-1.5 bg-red-50 text-red-700 text-xs font-semibold rounded-lg hover:bg-red-100 transition-colors flex items-center justify-center gap-1.5"
        >
          <Trash2 size={13} />
          Delete
        </button>
      </div>
    </div>
  );
}
