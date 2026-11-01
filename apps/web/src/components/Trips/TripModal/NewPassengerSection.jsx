import { useState } from "react";
import { User, Phone, Mail, MapPin, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { normalizePhone } from "@/utils/phoneNormalizer";

function NewPassengerSection({
  clients,
  onPassengerCreated,
  onPassengerExists,
  onBack,
  isOnlineBooking = false,
  settings = null,
}) {
  // Parse default locations from settings
  const defaultLocations = settings?.default_passenger_locations
    ? JSON.parse(settings.default_passenger_locations)
    : [];

  // Use first location as initial default, or empty values
  const initialLocation = defaultLocations[0] || {
    city: "",
    state: "",
    zip: "",
  };

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    street_address: "",
    city: initialLocation.city || "",
    state: initialLocation.state || "",
    zip_code: initialLocation.zip || "",
    notification_preference: "both",
    cc_emails: "",
  });
  const [isCreating, setIsCreating] = useState(false);

  // Handle location selection from dropdown
  const handleLocationSelect = (locationId) => {
    const location = defaultLocations.find(
      (loc) => loc.id === parseInt(locationId),
    );
    if (location) {
      setFormData((prev) => ({
        ...prev,
        city: location.city,
        state: location.state,
        zip_code: location.zip,
      }));
    }
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    // Validation
    if (!formData.name?.trim()) {
      toast.error("Please enter a name");
      return;
    }
    if (!formData.phone?.trim() && !formData.email?.trim()) {
      toast.error("Please enter at least a phone number or email");
      return;
    }

    // Home address is optional — skip city/state validation

    // Check if passenger already exists by name + phone or name + email
    const nameLower = formData.name.trim().toLowerCase();
    const nameMatch = (c) => c.name?.toLowerCase() === nameLower;

    const existingByPhone = formData.phone?.trim()
      ? clients?.find(
          (c) =>
            nameMatch(c) &&
            c.phone &&
            normalizePhone(c.phone) === normalizePhone(formData.phone.trim()),
        )
      : null;

    const existingByEmail = formData.email?.trim()
      ? clients?.find(
          (c) =>
            nameMatch(c) &&
            c.email &&
            c.email.toLowerCase() === formData.email.trim().toLowerCase(),
        )
      : null;

    const existingPassenger = existingByPhone || existingByEmail;

    if (existingPassenger) {
      // Passenger already exists - show error modal
      onPassengerExists(existingPassenger);
      return;
    }

    setIsCreating(true);
    try {
      // Don't store email if preference is SMS-only; don't store phone if email-only
      const dataToSubmit = {
        ...formData,
        email:
          formData.notification_preference === "sms"
            ? null
            : formData.email?.trim() || null,
        phone:
          formData.notification_preference === "email"
            ? null
            : formData.phone?.trim() || null,
      };

      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataToSubmit),
      });

      const resData = await res.json();

      if (!res.ok) {
        if (res.status === 409 && resData.existing_id) {
          // Duplicate detected server-side — treat as existing passenger
          const existing = clients?.find((c) => c.id === resData.existing_id);
          if (existing) {
            onPassengerExists(existing);
          } else {
            toast.error(
              resData.error ||
                "A passenger with this name and contact info already exists.",
            );
          }
          return;
        }
        throw new Error(resData.error || "Failed to create passenger");
      }

      toast.success(`Passenger ${resData.name} created successfully`);
      onPassengerCreated(resData);
    } catch (error) {
      console.error("Failed to create passenger:", error);
      toast.error(error.message || "Failed to create passenger");
    } finally {
      setIsCreating(false);
    }
  };

  // Use "your" for online bookings, "their" for admin bookings
  const possessive = isOnlineBooking ? "your" : "their";
  const possessiveCapitalized = isOnlineBooking ? "Your" : "Their";

  return (
    <div className="p-8 space-y-6 overflow-y-auto max-h-[calc(90vh-120px)]">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-bold text-gray-900">New Passenger</h2>
        <p className="text-sm text-gray-500">
          Enter {possessive} contact information to continue
        </p>
      </div>

      {/* Name */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <User size={14} className="text-gray-400" />
          {possessiveCapitalized} Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          placeholder="John Doe"
          value={formData.name}
          onChange={(e) => handleChange("name", e.target.value)}
          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Phone */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <Phone size={14} className="text-gray-400" />
          {possessiveCapitalized} Phone
        </label>
        <input
          type="tel"
          placeholder="(555) 000-0000"
          value={formData.phone}
          onChange={(e) => handleChange("phone", e.target.value)}
          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Email */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <Mail size={14} className="text-gray-400" />
          {possessiveCapitalized} Email
        </label>
        <input
          type="email"
          placeholder="john@example.com"
          value={formData.email}
          onChange={(e) => handleChange("email", e.target.value)}
          autoComplete="off"
          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* CC Emails */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <Mail size={14} className="text-gray-400" />
          Additional CC Emails (Optional)
        </label>
        <input
          type="text"
          placeholder="spouse@example.com, assistant@example.com"
          value={formData.cc_emails}
          onChange={(e) => handleChange("cc_emails", e.target.value)}
          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <p className="text-xs text-gray-400">
          Separate multiple emails with commas - these will receive booking
          confirmations
        </p>
      </div>

      {/* Home Address */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <MapPin size={14} className="text-gray-400" />
          {possessiveCapitalized} Home Address (Optional)
        </label>

        {/* Location preset dropdown - only show if multiple defaults exist */}
        {defaultLocations.length > 1 && (
          <div className="mb-2">
            <select
              onChange={(e) => handleLocationSelect(e.target.value)}
              className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Quick Fill: Select a default location...</option>
              {defaultLocations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.city}, {loc.state} {loc.zip}
                </option>
              ))}
            </select>
          </div>
        )}

        <input
          type="text"
          placeholder="123 Main St"
          value={formData.street_address}
          onChange={(e) => handleChange("street_address", e.target.value)}
          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <div className="grid grid-cols-3 gap-2">
          <input
            type="text"
            placeholder="City"
            value={formData.city}
            onChange={(e) => handleChange("city", e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <input
            type="text"
            placeholder="State"
            value={formData.state}
            onChange={(e) => handleChange("state", e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <input
            type="text"
            placeholder="ZIP"
            value={formData.zip_code}
            onChange={(e) => handleChange("zip_code", e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Notification Preference */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-gray-700">
          How should we contact {isOnlineBooking ? "you" : "them"}?
        </label>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => handleChange("notification_preference", "both")}
            className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-all ${
              formData.notification_preference === "both"
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-gray-200 text-gray-600 hover:border-gray-400 bg-white"
            }`}
          >
            Both
          </button>
          <button
            type="button"
            onClick={() => handleChange("notification_preference", "email")}
            className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-all ${
              formData.notification_preference === "email"
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-gray-200 text-gray-600 hover:border-gray-400 bg-white"
            }`}
          >
            Email Only
          </button>
          <button
            type="button"
            onClick={() => handleChange("notification_preference", "sms")}
            className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-all ${
              formData.notification_preference === "sms"
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-gray-200 text-gray-600 hover:border-gray-400 bg-white"
            }`}
          >
            SMS Only
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3 pt-4">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isCreating}
          className="w-full py-3 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isCreating ? (
            "Creating Passenger..."
          ) : (
            <>
              Continue to Trip Details
              <ChevronRight size={16} />
            </>
          )}
        </button>
        <button
          type="button"
          onClick={onBack}
          className="w-full text-center text-sm text-gray-400 hover:text-gray-600 font-medium"
        >
          ← Back
        </button>
      </div>
    </div>
  );
}

export default NewPassengerSection;
