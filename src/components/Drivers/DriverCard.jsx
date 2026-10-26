import {
  Mail,
  Phone,
  Calendar,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  RotateCcw,
  Car,
  MapPin,
  Image,
  ChevronLeft,
  ChevronRight,
  X,
  User,
  Power,
} from "lucide-react";
import { useState } from "react";

export function DriverCard({
  driver,
  vehicles,
  vehicleAssignments = [],
  onEdit,
  onDelete,
  onToggleActive,
}) {
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileIndex, setProfileIndex] = useState(0);

  // Use first_name for display, or fall back to name field
  const displayName = driver.first_name || driver.name;
  // Use first letter of first_name or name for avatar
  const avatarInitial = (driver.first_name || driver.name || "").charAt(0);

  // Only vehicle assignments that have a profile image
  const profiledAssignments = vehicleAssignments.filter(
    (va) => va.profile_image_url,
  );

  const currentProfile = profiledAssignments[profileIndex];

  const openProfile = () => {
    setProfileIndex(0);
    setShowProfileModal(true);
  };

  const prevProfile = () =>
    setProfileIndex(
      (i) => (i - 1 + profiledAssignments.length) % profiledAssignments.length,
    );

  const nextProfile = () =>
    setProfileIndex((i) => (i + 1) % profiledAssignments.length);

  return (
    <>
      {/* Profile Carousel Modal */}
      {showProfileModal && profiledAssignments.length > 0 && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setShowProfileModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {displayName}'s Profiles
                </h3>
                {profiledAssignments.length > 1 && (
                  <p className="text-sm text-gray-500">
                    {profileIndex + 1} of {profiledAssignments.length}
                    {currentProfile && ` — ${currentProfile.name}`}
                  </p>
                )}
                {profiledAssignments.length === 1 && currentProfile && (
                  <p className="text-sm text-gray-500">{currentProfile.name}</p>
                )}
              </div>
              <button
                onClick={() => setShowProfileModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            {/* Profile image */}
            <div className="relative bg-gray-50">
              <img
                src={currentProfile?.profile_image_url}
                alt={`${displayName} — ${currentProfile?.name}`}
                className="w-full max-h-[70vh] object-contain"
              />

              {/* Prev / Next arrows (only when multiple profiles) */}
              {profiledAssignments.length > 1 && (
                <>
                  <button
                    onClick={prevProfile}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 hover:bg-white rounded-full shadow-md flex items-center justify-center transition-colors"
                  >
                    <ChevronLeft size={20} className="text-gray-700" />
                  </button>
                  <button
                    onClick={nextProfile}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 hover:bg-white rounded-full shadow-md flex items-center justify-center transition-colors"
                  >
                    <ChevronRight size={20} className="text-gray-700" />
                  </button>
                </>
              )}
            </div>

            {/* Vehicle name + description */}
            {currentProfile && (
              <div className="px-6 py-4 border-t border-gray-100">
                <div className="flex items-center gap-2 mb-1">
                  <Car size={14} className="text-gray-400" />
                  <span className="text-sm font-semibold text-gray-800">
                    {currentProfile.name}
                  </span>
                  {currentProfile.color && (
                    <span className="text-xs text-gray-400">
                      · {currentProfile.color}
                    </span>
                  )}
                </div>
                {currentProfile.profile_description && (
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {currentProfile.profile_description}
                  </p>
                )}

                {/* Dot indicators */}
                {profiledAssignments.length > 1 && (
                  <div className="flex gap-1.5 justify-center mt-3">
                    {profiledAssignments.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setProfileIndex(i)}
                        className={`w-2 h-2 rounded-full transition-colors ${
                          i === profileIndex ? "bg-blue-600" : "bg-gray-300"
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div
        className={`bg-white rounded-xl border border-gray-200 p-6 hover:border-gray-300 transition-all group ${!driver.is_active ? "opacity-60 bg-gray-50" : ""}`}
      >
        {/* INACTIVE banner at top */}
        {!driver.is_active && (
          <div className="mb-3 -mt-2 -mx-2 px-3 py-2 bg-red-50 border-l-4 border-red-500 rounded">
            <div className="flex items-center gap-2">
              <ShieldAlert size={16} className="text-red-600" />
              <span className="text-sm font-bold text-red-600 uppercase tracking-wider">
                INACTIVE
              </span>
              <span className="text-xs text-red-500">
                — Not available for trips
              </span>
            </div>
          </div>
        )}

        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold"
              style={{ backgroundColor: driver.color }}
            >
              {avatarInitial}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{displayName}</h3>
              <div className="flex items-center gap-1.5 text-xs font-medium mt-1">
                {driver.is_active ? (
                  <span className="text-green-600 flex items-center gap-1">
                    <ShieldCheck size={12} /> Active
                  </span>
                ) : (
                  <span className="text-red-600 flex items-center gap-1">
                    <ShieldAlert size={12} /> Inactive
                  </span>
                )}
                <span className="text-gray-300">•</span>
                <span className="text-gray-500">
                  {Number(driver.salary_rate * 100)}% Comm.
                </span>
                <span className="text-gray-300">•</span>
                <span className="text-blue-500 flex items-center gap-0.5 font-semibold">
                  <RotateCcw size={10} /> #{driver.rotation_order || "—"}
                </span>
                {profiledAssignments.length > 0 && (
                  <>
                    <span className="text-gray-300">•</span>
                    <button
                      onClick={openProfile}
                      className="text-purple-600 flex items-center gap-1 hover:text-purple-800 transition-colors"
                    >
                      <Image size={12} />
                      {profiledAssignments.length === 1
                        ? "Has Profile"
                        : `${profiledAssignments.length} Profiles`}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onToggleActive(driver)}
              className={`p-2 rounded-lg ${driver.is_active ? "text-gray-400 hover:text-orange-600 hover:bg-orange-50" : "text-gray-400 hover:text-green-600 hover:bg-green-50"}`}
              title={
                driver.is_active ? "Deactivate Driver" : "Reactivate Driver"
              }
            >
              <Power size={18} />
            </button>
            <button
              onClick={() => onEdit(driver)}
              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
            >
              <Clock size={18} />
            </button>
            <button
              onClick={() => onDelete(driver.id)}
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Mail size={14} className="text-gray-400" />
            {driver.email || "No email"}
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Phone size={14} className="text-gray-400" />
            {driver.phone || "No phone"}
          </div>
          {driver.address && (
            <div className="flex items-start gap-2 text-sm text-gray-600">
              <MapPin size={14} className="text-gray-400 shrink-0 mt-0.5" />
              <span>{driver.address}</span>
            </div>
          )}
          {vehicles.length > 0 && (
            <div className="flex flex-col gap-1 pt-1">
              {vehicles.map((v) => {
                const va = vehicleAssignments.find(
                  (a) => a.vehicle_id === v.id,
                );
                const hasVehicleProfile = !!va?.profile_image_url;
                return (
                  <div
                    key={v.id}
                    className="flex items-center gap-2 text-sm text-gray-600"
                  >
                    <Car size={14} className="text-gray-400 shrink-0" />
                    <span className="font-medium text-gray-800">{v.name}</span>
                    {(v.color || v.category || v.passenger_capacity) && (
                      <span className="text-xs text-gray-400">
                        {[
                          v.color,
                          v.category,
                          v.passenger_capacity
                            ? `${v.passenger_capacity} passenger(s)`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    )}
                    {hasVehicleProfile && (
                      <span className="text-xs text-purple-500 font-semibold">
                        ✓ Profile
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-6 pt-6 border-t border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a
              href={`/schedule?employee_id=${driver.id}`}
              className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
            >
              <Calendar size={12} /> See My Schedule
            </a>
            <a
              href={`/calendar?employee_id=${driver.id}`}
              className="text-xs font-semibold text-purple-600 hover:underline flex items-center gap-1"
            >
              <Calendar size={12} /> See Calendar
            </a>
            <a
              href="/driver/portal"
              className="text-xs font-semibold text-green-600 hover:underline flex items-center gap-1"
            >
              <User size={12} /> Driver Portal
            </a>
          </div>
          <button
            onClick={() => onEdit(driver)}
            className="text-xs font-semibold text-gray-400 hover:text-gray-900 transition-colors"
          >
            Edit Details
          </button>
        </div>
      </div>
    </>
  );
}
