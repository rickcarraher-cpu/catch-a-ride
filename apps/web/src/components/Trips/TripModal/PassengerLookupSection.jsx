import { useState, useRef, useEffect } from "react";
import {
  Search,
  CheckCircle2,
  User,
  Phone,
  X,
  AlertCircle,
  Mail,
  MapPin,
  Settings,
  Plus,
  Trash2,
  Check,
} from "lucide-react";
import { normalizePhone } from "@/utils/phoneNormalizer";
import { toast } from "sonner";

function PassengerNotFoundModal({ searchQuery, onContinue, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-red-200 shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-red-50 border-b border-red-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={20} className="text-red-600" />
            <h3 className="font-bold text-red-900">Passenger Not Found</h3>
          </div>
          <button
            onClick={onClose}
            className="text-red-400 hover:text-red-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-700">
            We couldn't find a passenger matching:
          </p>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-sm font-semibold text-gray-900">
              "{searchQuery}"
            </p>
          </div>

          <p className="text-xs text-gray-600">
            This passenger doesn't exist in our system yet. Let's set them up as
            a new passenger.
          </p>

          <div className="flex flex-col gap-2 pt-2">
            <button
              onClick={onContinue}
              className="w-full py-3 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors"
            >
              Continue to New Passenger Setup
            </button>
            <button
              onClick={onClose}
              className="w-full text-center text-sm text-gray-400 hover:text-gray-600 font-medium py-2"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PassengerLookupSection({
  clients,
  onSelectPassenger,
  onSkip,
  onBack,
  settings = null,
  onSettingsUpdate = null,
  isEditMode = false, // NEW: when true, search ALL passengers including inactive
}) {
  const [searchType, setSearchType] = useState("name"); // 'name' | 'phone'
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedPassenger, setSelectedPassenger] = useState(null);
  const [showNotFoundModal, setShowNotFoundModal] = useState(false);
  const [notFoundQuery, setNotFoundQuery] = useState("");
  const searchRef = useRef(null);

  // NEW: Edit mode state
  const [showEditPrompt, setShowEditPrompt] = useState(false);
  const [isEditingPassenger, setIsEditingPassenger] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: "",
    phone: "",
    email: "",
    notification_preference: "both",
  });

  // NEW: Location defaults management state
  const [showLocationDefaults, setShowLocationDefaults] = useState(false);
  const savedLocations = settings?.default_passenger_locations
    ? JSON.parse(settings.default_passenger_locations)
    : [];
  const [locations, setLocations] = useState(savedLocations);
  const [newLocation, setNewLocation] = useState({
    city: "",
    state: "",
    zip: "",
  });

  useEffect(() => {
    // ✅ Allow partial match with just 1 character (was 2)
    if (searchQuery.length < 1) {
      setSearchResults([]);
      return;
    }

    const filtered =
      clients?.filter((c) => {
        // Exclude inactive passengers from booking wizard search results
        if (c.is_active === false) return false;

        const q = searchQuery.toLowerCase();
        if (searchType === "phone") {
          return c.phone && normalizePhone(c.phone).includes(normalizePhone(q));
        } else if (searchType === "address") {
          return (
            c.street_address?.toLowerCase().includes(q) ||
            c.city?.toLowerCase().includes(q) ||
            c.state?.toLowerCase().includes(q) ||
            c.zip_code?.includes(searchQuery) ||
            c.address?.toLowerCase().includes(q)
          );
        } else {
          // ✅ Case-insensitive partial name match
          return c.name?.toLowerCase().includes(q);
        }
      }) || [];

    setSearchResults(filtered); // show ALL matching results (no limit)

    // If user has searched with sufficient length but got no results, show modal
    // ✅ Reduce threshold to 2 chars (was 3) for "not found" modal
    if (searchQuery.length >= 2 && filtered.length === 0) {
      setNotFoundQuery(searchQuery);
      setShowNotFoundModal(true);
    }
  }, [searchQuery, searchType, clients, isEditMode]);

  const handleSelect = (client) => {
    setSelectedPassenger(client);
    setEditFormData({
      name: client.name || "",
      phone: client.phone || "",
      email: client.email || "",
      notification_preference: client.notification_preference || "both",
    });
    setSearchResults([]);
    setSearchQuery("");
    setShowEditPrompt(true);
  };

  const handleNoChangesNeeded = () => {
    setShowEditPrompt(false);
    onSelectPassenger(selectedPassenger);
  };

  const handleEditPassenger = () => {
    setShowEditPrompt(false);
    setIsEditingPassenger(true);
  };

  const handleSavePassengerUpdates = async () => {
    if (!selectedPassenger) {
      toast.error("No passenger selected");
      return;
    }

    try {
      // Don't store email if SMS-only; don't store phone if email-only
      const dataToSave = {
        ...editFormData,
        email:
          editFormData.notification_preference === "sms"
            ? null
            : editFormData.email?.trim() || null,
        phone:
          editFormData.notification_preference === "email"
            ? null
            : editFormData.phone?.trim() || null,
      };

      const res = await fetch(`/api/clients/${selectedPassenger.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataToSave),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update passenger");
      }

      const updatedClient = await res.json();
      toast.success("Passenger information updated ✓");
      setIsEditingPassenger(false);
      // Pass the updated client data to parent
      onSelectPassenger(updatedClient);
    } catch (error) {
      console.error("Failed to update passenger:", error);
      toast.error(error.message || "Failed to update passenger");
    }
  };

  const handleContinue = () => {
    if (selectedPassenger) {
      setShowEditPrompt(true);
    }
  };

  const handleNotFoundContinue = () => {
    setShowNotFoundModal(false);
    onSkip();
  };

  const handleCloseNotFoundModal = () => {
    setShowNotFoundModal(false);
    setSearchQuery("");
    setNotFoundQuery("");
  };

  // NEW: Location defaults handlers
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

  const handleSaveLocations = async () => {
    if (!onSettingsUpdate) {
      toast.error("Cannot save settings from this context");
      return;
    }

    try {
      await onSettingsUpdate(
        "default_passenger_locations",
        JSON.stringify(locations),
      );
      toast.success("Default locations saved ✓");
      setShowLocationDefaults(false);
      setNewLocation({ city: "", state: "", zip: "" });
    } catch (error) {
      console.error("Failed to save locations:", error);
      toast.error("Failed to save locations");
    }
  };

  const handleCancelLocationEdit = () => {
    setLocations(savedLocations);
    setShowLocationDefaults(false);
    setNewLocation({ city: "", state: "", zip: "" });
  };

  return (
    <>
      {showNotFoundModal && (
        <PassengerNotFoundModal
          searchQuery={notFoundQuery}
          onContinue={handleNotFoundContinue}
          onClose={handleCloseNotFoundModal}
        />
      )}

      <div className="p-8 space-y-6 overflow-y-auto max-h-[calc(90vh-120px)]">
        {/* Location Defaults Management Modal */}
        {showLocationDefaults && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-blue-200 shadow-2xl w-full max-w-2xl overflow-hidden">
              <div className="bg-blue-50 border-b border-blue-200 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin size={20} className="text-blue-600" />
                  <h3 className="font-bold text-blue-900">
                    Manage Default Locations
                  </h3>
                </div>
                <button
                  onClick={handleCancelLocationEdit}
                  className="text-blue-400 hover:text-blue-600 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                <p className="text-xs text-gray-500">
                  These locations will be available when adding a new passenger.
                  You can select which one to use for each passenger.
                </p>

                {/* Existing locations */}
                {locations.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
                      Current Locations ({locations.length}):
                    </p>
                    {locations.map((loc) => (
                      <div
                        key={loc.id}
                        className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3"
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
                <div className="space-y-3 pt-3 border-t border-gray-200">
                  <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                    Add New Location:
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        City
                      </label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 focus:outline-none"
                        value={newLocation.city}
                        onChange={(e) =>
                          setNewLocation({
                            ...newLocation,
                            city: e.target.value,
                          })
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
                          setNewLocation({
                            ...newLocation,
                            zip: e.target.value,
                          })
                        }
                        placeholder="e.g. 37066"
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleAddLocation}
                    disabled={
                      !newLocation.city ||
                      !newLocation.state ||
                      !newLocation.zip
                    }
                    className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus size={14} />
                    Add Location
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center gap-2">
                <button
                  onClick={handleSaveLocations}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Check size={14} />
                  Save All Changes
                </button>
                <button
                  onClick={handleCancelLocationEdit}
                  className="flex items-center gap-1.5 px-4 py-2 bg-white text-gray-600 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <X size={14} />
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* NEW: Edit prompt when passenger is selected */}
        {showEditPrompt && selectedPassenger && (
          <>
            <div className="text-center space-y-2">
              <h2 className="text-xl font-bold text-gray-900">
                Passenger Found
              </h2>
              <p className="text-sm text-gray-500">
                Do you need to update their information?
              </p>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle2 size={18} />
                <span className="text-sm font-semibold">
                  Current Information
                </span>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-gray-900">
                  {selectedPassenger.name}
                </p>
                {selectedPassenger.phone && (
                  <p className="text-xs text-gray-600">
                    {selectedPassenger.phone}
                  </p>
                )}
                {selectedPassenger.email && (
                  <p className="text-xs text-gray-500">
                    {selectedPassenger.email}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleNoChangesNeeded}
                className="flex flex-col items-center gap-2 py-5 px-4 rounded-xl border-2 border-green-200 bg-green-50 hover:border-green-400 hover:bg-green-100 transition-all"
              >
                <CheckCircle2 size={24} className="text-green-600" />
                <span className="text-base font-bold text-green-800">
                  Looks Good
                </span>
              </button>
              <button
                type="button"
                onClick={handleEditPassenger}
                className="flex flex-col items-center gap-2 py-5 px-4 rounded-xl border-2 border-indigo-200 bg-indigo-50 hover:border-indigo-400 hover:bg-indigo-100 transition-all"
              >
                <User size={24} className="text-indigo-600" />
                <span className="text-base font-bold text-indigo-800">
                  Update Their Info
                </span>
              </button>
            </div>
          </>
        )}

        {/* NEW: Edit passenger form */}
        {isEditingPassenger && selectedPassenger && (
          <>
            <div className="text-center space-y-2">
              <h2 className="text-xl font-bold text-gray-900">
                Update Passenger Information
              </h2>
              <p className="text-sm text-gray-500">
                Make changes to their profile
              </p>
            </div>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-2">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Full name"
                  value={editFormData.name}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, name: e.target.value })
                  }
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Notification Preference */}
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-2">
                  How should we contact them?
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {["both", "email", "sms"].map((pref) => (
                    <button
                      key={pref}
                      type="button"
                      onClick={() =>
                        setEditFormData({
                          ...editFormData,
                          notification_preference: pref,
                        })
                      }
                      className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-all ${
                        editFormData.notification_preference === pref
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-gray-200 text-gray-600 hover:border-gray-400 bg-white"
                      }`}
                    >
                      {pref === "both"
                        ? "Both"
                        : pref === "email"
                          ? "Email Only"
                          : "SMS Only"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Phone */}
              {(editFormData.notification_preference === "sms" ||
                editFormData.notification_preference === "both") && (
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-2">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    placeholder="(555) 000-0000"
                    value={editFormData.phone}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        phone: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              {/* Email */}
              {(editFormData.notification_preference === "email" ||
                editFormData.notification_preference === "both") && (
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-2">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    placeholder="passenger@email.com"
                    value={editFormData.email}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        email: e.target.value,
                      })
                    }
                    autoComplete="off"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleSavePassengerUpdates}
              className="w-full py-3 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              Save Changes & Continue to Trip Details
            </button>

            <button
              type="button"
              onClick={() => {
                setIsEditingPassenger(false);
                setShowEditPrompt(true);
              }}
              className="w-full text-center text-sm text-gray-400 hover:text-gray-600 font-medium"
            >
              ← Back
            </button>
          </>
        )}

        {/* Original search interface - only show when not in edit mode */}
        {!showEditPrompt && !isEditingPassenger && (
          <>
            <div className="text-center space-y-2">
              <h2 className="text-xl font-bold text-gray-900">
                Find Passenger
              </h2>
              <p className="text-sm text-gray-500">
                Search by name or phone to autofill their contact info.
              </p>
            </div>

            {/* NEW: Location Defaults Quick Access */}
            {onSettingsUpdate && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin size={16} className="text-blue-600" />
                    <div>
                      <p className="text-xs font-semibold text-blue-900">
                        Default Locations
                      </p>
                      <p className="text-[11px] text-blue-600">
                        {savedLocations.length > 0
                          ? `${savedLocations.length} location${savedLocations.length !== 1 ? "s" : ""} configured`
                          : "No defaults set"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowLocationDefaults(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                  >
                    <Settings size={12} />
                    {savedLocations.length > 0 ? "Manage" : "Set Up"}
                  </button>
                </div>
              </div>
            )}

            {/* Toggle: Name / Phone / Address */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setSearchType("name");
                  setSearchQuery("");
                  setSearchResults([]);
                }}
                className={`py-2 px-3 rounded-xl border text-sm font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  searchType === "name"
                    ? "border-gray-900 bg-gray-900 text-white"
                    : "border-gray-200 text-gray-600 hover:border-gray-400 bg-white"
                }`}
              >
                <User size={14} />
                Name
              </button>
              <button
                type="button"
                onClick={() => {
                  setSearchType("phone");
                  setSearchQuery("");
                  setSearchResults([]);
                }}
                className={`py-2 px-3 rounded-xl border text-sm font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  searchType === "phone"
                    ? "border-gray-900 bg-gray-900 text-white"
                    : "border-gray-200 text-gray-600 hover:border-gray-400 bg-white"
                }`}
              >
                <Phone size={14} />
                Phone
              </button>
              <button
                type="button"
                onClick={() => {
                  setSearchType("address");
                  setSearchQuery("");
                  setSearchResults([]);
                }}
                className={`py-2 px-3 rounded-xl border text-sm font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  searchType === "address"
                    ? "border-gray-900 bg-gray-900 text-white"
                    : "border-gray-200 text-gray-600 hover:border-gray-400 bg-white"
                }`}
              >
                <MapPin size={14} />
                Address
              </button>
            </div>

            {/* Search input */}
            {!selectedPassenger && (
              <div className="relative">
                <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl">
                  <Search size={18} className="text-gray-400" />
                  <input
                    ref={searchRef}
                    type={searchType === "phone" ? "tel" : "text"}
                    placeholder={
                      searchType === "phone"
                        ? "Search by phone (555) 000-0000"
                        : searchType === "address"
                          ? "Search by street, city, state, or ZIP"
                          : "Search by name"
                    }
                    className="flex-1 bg-transparent border-none text-sm focus:outline-none"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                {/* Search results dropdown */}
                {searchResults.length > 0 && (
                  <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
                    {searchResults.map((client) => (
                      <button
                        key={client.id}
                        type="button"
                        onClick={() => handleSelect(client)}
                        className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-0"
                      >
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-gray-900">
                            {client.name}
                          </p>
                          {client.is_active === false && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-300">
                              Inactive
                            </span>
                          )}
                        </div>
                        {client.phone && (
                          <p className="text-xs text-gray-500">
                            {client.phone}
                          </p>
                        )}
                        {client.email && (
                          <p className="text-xs text-gray-400">
                            {client.email}
                          </p>
                        )}
                        {searchType === "address" &&
                          (client.street_address || client.city) && (
                            <p className="text-xs text-blue-500">
                              {[
                                client.street_address,
                                client.city,
                                client.state,
                                client.zip_code,
                              ]
                                .filter(Boolean)
                                .join(", ")}
                            </p>
                          )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={onSkip}
                className="w-full py-3 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Skip – Enter Passenger Info Manually
              </button>
              <button
                type="button"
                onClick={onBack}
                className="w-full text-center text-sm text-gray-400 hover:text-gray-600 font-medium"
              >
                ← Back
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

export default PassengerLookupSection;
