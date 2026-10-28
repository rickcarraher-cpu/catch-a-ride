import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  X,
  AlertCircle,
  Check,
  Bell,
  Search,
  Loader2,
  CheckCircle,
  XCircle,
  Edit2,
  Save,
} from "lucide-react";
import { toast } from "@/utils/notify";
import { createDateInCDT, getDatePartsInCDT } from "@/utils/timezone";

export function PassengerDriverSection({
  formData,
  setFormData,
  clients,
  drivers,
  tripId,
}) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const searchRef = useRef(null);
  const dropdownRef = useRef(null);
  const debounceRef = useRef(null);
  const clientsRef = useRef(clients);

  // Referral source editing state
  const [isEditingReferral, setIsEditingReferral] = useState(false);
  const [referralValue, setReferralValue] = useState("");

  // Keep clientsRef always up to date so the debounced search never uses stale data
  useEffect(() => {
    clientsRef.current = clients;
  }, [clients]);

  // Driver confirmation state
  const [pendingDriver, setPendingDriver] = useState(null);

  const selectedClient = clients?.find((c) => c.id == formData.client_id);

  // Update referral source mutation
  const updateReferralMutation = useMutation({
    mutationFn: async (newReferral) => {
      if (!selectedClient?.id) throw new Error("No passenger selected");
      const res = await fetch(`/api/clients/${selectedClient.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referral_source: newReferral }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update referral source");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setIsEditingReferral(false);
      toast.success("Referral source updated successfully!");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to update referral source");
    },
  });

  const handleSaveReferral = () => {
    updateReferralMutation.mutate(referralValue);
  };

  const handleCancelReferralEdit = () => {
    setReferralValue(selectedClient?.referral_source || "");
    setIsEditingReferral(false);
  };

  // Initialize referral value when passenger changes
  useEffect(() => {
    if (selectedClient) {
      setReferralValue(selectedClient.referral_source || "");
      setIsEditingReferral(false);
    }
  }, [selectedClient?.id]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (
        !searchRef.current?.contains(e.target) &&
        !dropdownRef.current?.contains(e.target)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Debounced search against local clients list
  const handleSearch = useCallback((q) => {
    setSearch(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 1) {
      setSearchResults([]);
      setShowDropdown(false);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    setShowDropdown(true);
    debounceRef.current = setTimeout(() => {
      const currentClients = clientsRef.current;
      const lower = q.trim().toLowerCase();
      const digits = q.replace(/\D/g, "");
      const filtered =
        currentClients?.filter((c) => {
          // Filter out inactive (deleted) passengers from search results
          if (c.is_active === false) return false;

          const nameMatch = (() => {
            if (!c.name) return false;
            const nameLower = c.name.toLowerCase();
            if (nameLower.includes(lower)) return true;
            const queryWords = lower.split(/\s+/).filter(Boolean);
            if (queryWords.length > 1) {
              return queryWords.every((w) => nameLower.includes(w));
            }
            return false;
          })();
          const phoneMatch =
            digits.length >= 3 &&
            c.phone &&
            c.phone.replace(/\D/g, "").includes(digits);
          return nameMatch || phoneMatch;
        }) || [];
      setSearchResults(filtered);
      setIsSearching(false);
    }, 200);
  }, []);

  const handleSelect = (client) => {
    const updates = { ...formData, client_id: client.id };
    if (client.address && !formData.pickup_address) {
      updates.pickup_address = client.address;
      updates._pickup_prefilled = true;
    }
    if (client.address) {
      updates.destination = client.address;
    }
    setFormData(updates);
    setSearch("");
    setSearchResults([]);
    setShowDropdown(false);
  };

  const handleClear = () => {
    // Use null (not "") to signal intentional passenger removal
    setFormData({ ...formData, client_id: null });
    setSearch("");
    setSearchResults([]);
    setShowDropdown(false);
    setTimeout(() => searchRef.current?.focus(), 50);
  };

  const { data: vehicles } = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => fetch("/api/vehicles").then((r) => r.json()),
  });

  // Fetch vehicle assignments for the selected driver
  const { data: driverVehicles } = useQuery({
    queryKey: ["vehicle-assignments", formData.employee_id],
    queryFn: async () => {
      const res = await fetch(
        `/api/vehicle-assignments?employee_id=${formData.employee_id}`,
      );
      if (!res.ok) throw new Error("Failed to fetch driver vehicles");
      return res.json();
    },
    enabled: !!formData.employee_id,
  });

  // Fetch vehicle categories for preference dropdown
  const { data: categoriesData } = useQuery({
    queryKey: ["vehicle-categories"],
    queryFn: async () => {
      const res = await fetch("/api/vehicles/categories");
      if (!res.ok) throw new Error("Failed to fetch vehicle categories");
      return res.json();
    },
  });
  const vehicleCategories = categoriesData?.categories || [];

  // Resend notification mutation
  const resendNotification = useMutation({
    mutationFn: async () => {
      if (!tripId) throw new Error("Trip must be saved first");
      const res = await fetch(
        `/api/appointments/${tripId}/resend-driver-notification`,
        { method: "POST" },
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to resend notification");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Driver notification resent successfully!");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to resend notification");
    },
  });

  const handleDriverChange = (val) => {
    if (!val) {
      // Send null (not "") so the backend treats this as an intentional unassignment.
      // Empty string "" now means "stale/unchanged" in the backend guard logic.
      setFormData({ ...formData, employee_id: null });
      return;
    }
    const driver = drivers?.find((d) => String(d.id) === String(val));
    if (driver) {
      setPendingDriver(driver);
    }
  };

  const confirmDriver = () => {
    setFormData({ ...formData, employee_id: pendingDriver.id });
    setPendingDriver(null);
  };

  const cancelDriver = () => {
    setPendingDriver(null);
  };

  const currentDriver = drivers?.find(
    (d) => String(d.id) === String(formData.employee_id),
  );

  // Compute the datetime-local display value in CDT
  const dateTimeLocalValue = (() => {
    if (!formData.start_time) return "";
    const isoString = formData.start_time;
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(isoString)) {
      return isoString.slice(0, 16);
    }
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString.slice(0, 16);
    const parts = getDatePartsInCDT(d);
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  })();

  // Extract date and time from start_time for separate inputs
  const dateValue = formData.start_time
    ? formData.start_time.split("T")[0]
    : "";
  const timeValue = formData.start_time
    ? formData.start_time.split("T")[1] || ""
    : "";

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Driver confirmation overlay */}
      {pendingDriver && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full border border-gray-200 text-center">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
              {formData.employee_id ? "Change Driver?" : "Assign Driver?"}
            </p>

            {pendingDriver.profile_image_url ? (
              <img
                src={pendingDriver.profile_image_url}
                alt={pendingDriver.name}
                className="w-24 h-24 rounded-full object-cover mx-auto border-4 border-white shadow-lg mb-3"
              />
            ) : (
              <div
                className="w-24 h-24 rounded-full mx-auto border-4 border-white shadow-lg mb-3 flex items-center justify-center text-white text-3xl font-bold"
                style={{ backgroundColor: pendingDriver.color || "#2563EB" }}
              >
                {pendingDriver.name.charAt(0).toUpperCase()}
              </div>
            )}

            <h3 className="text-xl font-bold text-gray-900">
              {pendingDriver.name}
            </h3>
            {pendingDriver.phone && (
              <p className="text-sm text-gray-400 mt-1">
                {pendingDriver.phone}
              </p>
            )}

            {formData.employee_id && currentDriver && (
              <p className="text-xs text-amber-600 mt-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5">
                Replacing:{" "}
                <span className="font-semibold">{currentDriver.name}</span>
              </p>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={cancelDriver}
                className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDriver}
                className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <Check size={16} />
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Passenger search */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-gray-500 uppercase">
          Passenger
        </label>
        <div className="relative">
          {selectedClient ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900">
                      {selectedClient.name}
                    </p>
                    {selectedClient.is_active === false && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-300">
                        Inactive
                      </span>
                    )}
                  </div>
                  {selectedClient.phone && (
                    <p className="text-xs text-gray-500">
                      {selectedClient.phone}
                    </p>
                  )}
                  {selectedClient.email && (
                    <p className="text-xs text-gray-500">
                      {selectedClient.email}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFormData({ ...formData, client_id: null });
                    setSearch("");
                    setSearchResults([]);
                    setShowDropdown(false);
                    setTimeout(() => searchRef.current?.focus(), 50);
                  }}
                  className="ml-2 text-gray-400 hover:text-red-500 transition-colors"
                  title="Change passenger"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Referral Source Field - Now Editable */}
              <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-amber-700 uppercase">
                    How did you hear about us?
                  </label>
                  {!isEditingReferral && (
                    <button
                      type="button"
                      onClick={() => setIsEditingReferral(true)}
                      className="text-amber-600 hover:text-amber-800 transition-colors"
                      title="Edit referral source"
                    >
                      <Edit2 size={12} />
                    </button>
                  )}
                </div>

                {isEditingReferral ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      className="w-full px-2 py-1.5 bg-white border border-amber-300 rounded text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      placeholder="e.g., Google, Friend referral, Facebook..."
                      value={referralValue}
                      onChange={(e) => setReferralValue(e.target.value)}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleSaveReferral}
                        disabled={updateReferralMutation.isPending}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white text-xs font-semibold rounded hover:bg-amber-700 disabled:opacity-50 transition-colors"
                      >
                        <Save size={12} />
                        {updateReferralMutation.isPending
                          ? "Saving..."
                          : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelReferralEdit}
                        disabled={updateReferralMutation.isPending}
                        className="px-3 py-1.5 bg-white border border-amber-300 text-amber-700 text-xs font-medium rounded hover:bg-amber-50 disabled:opacity-50 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-amber-800">
                    {selectedClient.referral_source || (
                      <span className="text-amber-600 italic">
                        Not set yet — click edit to add
                      </span>
                    )}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="relative flex items-center border border-gray-200 rounded-lg bg-white focus-within:ring-2 focus-within:ring-blue-600">
                <Search
                  size={15}
                  className="absolute left-3 text-gray-400 pointer-events-none"
                />
                <input
                  ref={searchRef}
                  type="text"
                  className="w-full pl-9 pr-8 py-2 bg-transparent rounded-lg text-sm focus:outline-none"
                  placeholder="Search by name or phone…"
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                  onFocus={() => search.length >= 1 && setShowDropdown(true)}
                />
                {isSearching && (
                  <Loader2
                    size={14}
                    className="absolute right-3 text-gray-400 animate-spin"
                  />
                )}
              </div>
              {showDropdown && search.length > 0 && (
                <div
                  ref={dropdownRef}
                  className="absolute z-[100] w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto"
                >
                  {isSearching ? (
                    <p className="px-3 py-2 text-xs text-gray-400">
                      Searching...
                    </p>
                  ) : searchResults.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-gray-400">
                      No passengers found
                    </p>
                  ) : (
                    searchResults.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleSelect(c);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-0 cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-gray-900">
                            {c.name}
                          </p>
                          {c.is_active === false && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-300">
                              Inactive
                            </span>
                          )}
                        </div>
                        {c.phone && (
                          <p className="text-xs text-gray-400">{c.phone}</p>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Driver dropdown */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-gray-500 uppercase">
          Driver
        </label>

        {currentDriver && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
              {currentDriver.profile_image_url ? (
                <img
                  src={currentDriver.profile_image_url}
                  alt={currentDriver.name}
                  className="w-8 h-8 rounded-full object-cover border-2 border-white shadow-sm shrink-0"
                />
              ) : (
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold border-2 border-white shadow-sm shrink-0"
                  style={{ backgroundColor: currentDriver.color || "#2563EB" }}
                >
                  {currentDriver.name.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="text-sm font-semibold text-gray-900 flex-1">
                {currentDriver.name}
              </span>
            </div>

            {tripId && (
              <button
                type="button"
                onClick={() => resendNotification.mutate()}
                disabled={resendNotification.isPending}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 bg-purple-50 border border-purple-200 text-purple-700 text-xs font-semibold rounded-lg hover:bg-purple-100 transition-colors disabled:opacity-50"
                title="Resend email and SMS notification to driver"
              >
                <Bell size={14} />
                {resendNotification.isPending
                  ? "Sending..."
                  : "Resend Notification to Driver"}
              </button>
            )}
          </div>
        )}

        <select
          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
          value={formData.employee_id}
          onChange={(e) => handleDriverChange(e.target.value)}
        >
          <option value="">Unassigned</option>
          {drivers
            ?.filter(
              (d) =>
                d.is_active || String(d.id) === String(formData.employee_id),
            )
            ?.slice()
            .sort((a, b) => {
              const aFirst = a.name.split(" ")[0] || "";
              const bFirst = b.name.split(" ")[0] || "";
              return aFirst.localeCompare(bFirst);
            })
            .map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
        </select>
      </div>

      {/* Vehicle - only show when a driver is assigned */}
      {formData.employee_id && (
        <div className="space-y-1.5 md:col-span-2">
          <label className="text-xs font-semibold text-gray-500 uppercase">
            Vehicle
          </label>
          <div className="flex gap-2">
            <select
              className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
              value={formData.vehicle_id}
              onChange={(e) =>
                setFormData({ ...formData, vehicle_id: e.target.value })
              }
            >
              <option value="">Select Vehicle</option>
              {(() => {
                const driverVehicleIds = new Set(
                  (driverVehicles || []).map((v) => v.vehicle_id),
                );
                const assignedVehicles = (vehicles || []).filter((v) =>
                  driverVehicleIds.has(v.id),
                );
                const otherVehicles = (vehicles || []).filter(
                  (v) => !driverVehicleIds.has(v.id),
                );
                if (assignedVehicles.length > 0) {
                  return (
                    <>
                      <optgroup label="Driver's Vehicles">
                        {assignedVehicles.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name}
                            {v.year ? ` (${v.year})` : ""}
                            {v.color ? ` — ${v.color}` : ""}
                            {v.category ? ` [${v.category}]` : ""}
                          </option>
                        ))}
                      </optgroup>
                      {otherVehicles.length > 0 && (
                        <optgroup label="Other Vehicles">
                          {otherVehicles.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name}
                              {v.year ? ` (${v.year})` : ""}
                              {v.color ? ` — ${v.color}` : ""}
                              {v.category ? ` [${v.category}]` : ""}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </>
                  );
                }
                return vehicles?.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                    {v.year ? ` (${v.year})` : ""}
                  </option>
                ));
              })()}
            </select>
            <button
              type="button"
              onClick={() => {
                const vName = prompt("Enter vehicle name (e.g. Audi Q7):");
                if (!vName) return;
                fetch("/api/vehicles", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    name: vName,
                    employee_id: formData.employee_id || null,
                  }),
                })
                  .then((r) => r.json())
                  .then((v) => {
                    queryClient.invalidateQueries(["vehicles"]);
                    setFormData((fd) => ({ ...fd, vehicle_id: v.id }));
                  });
              }}
              className="px-3 py-2 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors whitespace-nowrap"
            >
              + Add Vehicle
            </button>
          </div>
        </div>
      )}

      {/* Date & Time - Split into separate inputs */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-500 uppercase">
            Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
            value={dateValue}
            onChange={(e) => {
              const newDate = e.target.value;
              const currentTime = timeValue || "09:00";
              setFormData({
                ...formData,
                start_time: `${newDate}T${currentTime}`,
              });
            }}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-500 uppercase">
            Time <span className="text-red-500">*</span>
          </label>
          <input
            type="time"
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
            value={timeValue}
            onChange={(e) => {
              const newTime = e.target.value;
              const currentDate =
                dateValue || new Date().toISOString().split("T")[0];
              setFormData({
                ...formData,
                start_time: `${currentDate}T${newTime}`,
              });
            }}
          />
        </div>
      </div>

      {/* Vehicle Preference / Category */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-gray-500 uppercase">
          Vehicle Preference <span className="text-red-500">*</span>
        </label>
        <select
          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
          value={formData.vehicle_category || ""}
          onChange={(e) =>
            setFormData({
              ...formData,
              vehicle_category: e.target.value || null,
            })
          }
        >
          <option value="" disabled>
            — Select vehicle type —
          </option>
          {vehicleCategories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
