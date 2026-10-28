"use client";

import React, { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, ChevronDown, Check, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export default function TenantSwitcher() {
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const dropdownRef = useRef(null);
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["tenants"],
    queryFn: async () => {
      const res = await fetch("/api/tenants");
      if (!res.ok) throw new Error("Failed to load tenants");
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
  });

  const tenants = data?.tenants || [];
  const currentTenantId = data?.currentTenantId;

  const currentTenant =
    tenants.find((t) => t.id === currentTenantId) ||
    tenants.find((t) => t.id === 1) ||
    tenants[0];

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const switchTenant = async (tenantId) => {
    if (switching) return;
    setSwitching(true);
    setOpen(false);
    try {
      const res = await fetch("/api/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId }),
      });
      if (!res.ok) throw new Error("Failed to switch tenant");
      const result = await res.json();

      // Clear all cached session data and reload so every API call
      // goes fresh with the new tenant cookie set
      if (typeof window !== "undefined") {
        sessionStorage.clear();
      }
      toast.success(`Switched to ${result.tenant?.name || "tenant"}`);
      window.location.reload();
    } catch (err) {
      console.error("[TenantSwitcher]", err);
      toast.error("Failed to switch tenant");
    } finally {
      setSwitching(false);
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-400 text-sm">
        <Building2 size={13} />
        <span className="text-xs">Loading...</span>
      </div>
    );
  }

  // If no tenants at all, show nothing
  if (tenants.length === 0) return null;

  // Single tenant — show as read-only badge (no dropdown)
  if (tenants.length === 1) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-sm font-medium">
        <Building2 size={13} />
        <span className="max-w-[120px] truncate">
          {currentTenant?.name || "Tenant"}
        </span>
      </div>
    );
  }

  // Multiple tenants — show dropdown switcher
  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={switching}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 transition-colors text-indigo-700 text-sm font-medium disabled:opacity-60"
        title="Switch tenant"
      >
        {switching ? (
          <RefreshCw size={13} className="animate-spin" />
        ) : (
          <Building2 size={13} />
        )}
        <span className="max-w-[120px] truncate">
          {currentTenant?.name || "Select Tenant"}
        </span>
        <ChevronDown
          size={12}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[180px]">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-3 pt-1.5 pb-1">
            Switch Tenant
          </p>
          {tenants.map((tenant) => {
            const isActive =
              tenant.id === currentTenantId ||
              (!currentTenantId && tenant.id === 1);
            return (
              <button
                key={tenant.id}
                onClick={() => switchTenant(tenant.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors ${
                  isActive ? "text-indigo-700 font-semibold" : "text-gray-700"
                }`}
              >
                <Building2
                  size={13}
                  className={isActive ? "text-indigo-500" : "text-gray-400"}
                />
                <span className="flex-1 truncate">{tenant.name}</span>
                {isActive && (
                  <Check size={13} className="text-indigo-500 shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
