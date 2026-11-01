import { useState } from "react";
import {
  Search,
  FileText,
  Calendar,
  MapPin,
  Loader2,
  ArrowRight,
  Phone,
  Home,
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";

function TripCloneSection({ onSelectTrip, onSkip, onBack }) {
  const [searchMode, setSearchMode] = useState("passenger"); // 'number' | 'passenger'
  const [bookingNumber, setBookingNumber] = useState("");
  const [passengerSearch, setPassengerSearch] = useState("");
  const [matchedPassenger, setMatchedPassenger] = useState(null);
  const [allTrips, setAllTrips] = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [useHomeForPickup, setUseHomeForPickup] = useState(false);
  const [useHomeForDropoff, setUseHomeForDropoff] = useState(false);
  // NEW: Track passenger's home address availability
  const [passengerHomeAddress, setPassengerHomeAddress] = useState(null);
  const [loadingHomeAddress, setLoadingHomeAddress] = useState(false);

  // Lookup by booking number (keep existing logic)
  const lookupMutation = useMutation({
    mutationFn: async (number) => {
      const res = await fetch(
        `/api/appointments/lookup?booking_number=${encodeURIComponent(number)}`,
      );
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to look up booking");
      return res.json();
    },
    onSuccess: async (data) => {
      if (data) {
        if (data.status === "deleted") {
          toast.error("That trip has been deleted and cannot be cloned.");
          return;
        }
        setSelectedTrip(data);

        // NEW: Fetch passenger's home address when trip is found by booking number
        if (data.client_id) {
          setLoadingHomeAddress(true);
          try {
            const res = await fetch(`/api/clients/${data.client_id}`);
            if (res.ok) {
              const clientData = await res.json();
              // Check if passenger has a structured home address
              const hasStructuredAddress = !!(
                clientData.street_address &&
                clientData.city &&
                clientData.state &&
                clientData.zip_code
              );
              // Check if passenger has legacy address
              const hasLegacyAddress = !!clientData.address?.trim();

              if (hasStructuredAddress || hasLegacyAddress) {
                setPassengerHomeAddress({
                  street: clientData.street_address || "",
                  city: clientData.city || "",
                  state: clientData.state || "",
                  zip: clientData.zip_code || "",
                  legacy: clientData.address || "",
                });
              } else {
                setPassengerHomeAddress(null);
              }
            } else {
              setPassengerHomeAddress(null);
            }
          } catch (err) {
            console.error("Failed to fetch passenger home address:", err);
            setPassengerHomeAddress(null);
          } finally {
            setLoadingHomeAddress(false);
          }
        }
      } else {
        toast.error("No booking found with that number");
      }
    },
    onError: () => {
      toast.error("Failed to look up booking");
    },
  });

  // Search for passenger and get ALL their trips
  const passengerSearchMutation = useMutation({
    mutationFn: async (query) => {
      // Search clients directly instead of searching through appointments
      // This avoids matching wrong clients when name appears in notes/destinations
      const clientsRes = await fetch(
        `/api/clients?search=${encodeURIComponent(query)}`,
      );
      if (!clientsRes.ok) throw new Error("Failed to search clients");
      const clientsData = await clientsRes.json();

      // Filter clients matching the query by name, phone, or email
      const q = query.toLowerCase();
      const digits = query.replace(/\D/g, "");
      const matchingClients = (clientsData || []).filter((c) => {
        if (c.name && c.name.toLowerCase().includes(q)) return true;
        if (c.email && c.email.toLowerCase().includes(q)) return true;
        if (digits.length >= 3 && c.phone) {
          const clientDigits = c.phone.replace(/\D/g, "");
          if (clientDigits.includes(digits)) return true;
        }
        return false;
      });

      if (matchingClients.length === 0) {
        return { passenger: null, trips: [] };
      }

      // Use the first matching client
      const client = matchingClients[0];

      // Fetch ALL trips for this passenger
      const tripsRes = await fetch(`/api/clients/${client.id}/appointments`);
      if (!tripsRes.ok) throw new Error("Failed to fetch passenger trips");
      const allTrips = await tripsRes.json();

      // Filter out deleted trips only - cancelled trips can be cloned
      const activeTrips = allTrips.filter((trip) => trip.status !== "deleted");

      return {
        passenger: {
          id: client.id,
          name: client.name,
        },
        trips: activeTrips.sort(
          (a, b) => new Date(b.start_time) - new Date(a.start_time),
        ),
      };
    },
    onSuccess: (data) => {
      if (!data.passenger) {
        toast.error("No passenger found");
        return;
      }

      setMatchedPassenger(data.passenger);
      setAllTrips(data.trips);

      if (data.trips.length === 0) {
        toast("Passenger found, but no trips on record.");
      } else {
        toast.success(
          `Found ${data.trips.length} trip(s) for ${data.passenger.name}`,
        );
      }
    },
    onError: () => {
      toast.error("Search failed. Please try again.");
    },
  });

  const handleContinue = () => {
    if (selectedTrip) {
      onSelectTrip(selectedTrip, {
        useHomeForPickup,
        useHomeForDropoff,
      });
    }
  };

  const handleSelectTripFromList = async (trip) => {
    setSelectedTrip(trip);

    // NEW: Fetch passenger's home address when trip is selected
    if (trip.client_id) {
      setLoadingHomeAddress(true);
      try {
        const res = await fetch(`/api/clients/${trip.client_id}`);
        if (res.ok) {
          const clientData = await res.json();
          // Check if passenger has a structured home address
          const hasStructuredAddress = !!(
            clientData.street_address &&
            clientData.city &&
            clientData.state &&
            clientData.zip_code
          );
          // Check if passenger has legacy address
          const hasLegacyAddress = !!clientData.address?.trim();

          if (hasStructuredAddress || hasLegacyAddress) {
            setPassengerHomeAddress({
              street: clientData.street_address || "",
              city: clientData.city || "",
              state: clientData.state || "",
              zip: clientData.zip_code || "",
              legacy: clientData.address || "",
            });
          } else {
            setPassengerHomeAddress(null);
          }
        } else {
          setPassengerHomeAddress(null);
        }
      } catch (err) {
        console.error("Failed to fetch passenger home address:", err);
        setPassengerHomeAddress(null);
      } finally {
        setLoadingHomeAddress(false);
      }
    }
  };

  // NEW: Check if passenger has a home address
  const hasPassengerAddress = !!passengerHomeAddress;

  return (
    <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-bold text-gray-900">Find Trip to Clone</h2>
        <p className="text-sm text-gray-500">
          Search by passenger name or booking number to copy trip details.
        </p>
      </div>

      {/* Toggle: By Name / By Number */}
      {!selectedTrip && !matchedPassenger && (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setSearchMode("passenger");
              setBookingNumber("");
            }}
            className={`py-2 px-3 rounded-xl border text-sm font-semibold flex items-center justify-center gap-1.5 transition-all ${
              searchMode === "passenger"
                ? "border-purple-700 bg-purple-700 text-white"
                : "border-purple-200 text-purple-700 hover:border-purple-400 bg-white"
            }`}
          >
            <Search size={14} />
            By Name
          </button>
          <button
            type="button"
            onClick={() => {
              setSearchMode("number");
              setAllTrips([]);
              setPassengerSearch("");
              setMatchedPassenger(null);
            }}
            className={`py-2 px-3 rounded-xl border text-sm font-semibold flex items-center justify-center gap-1.5 transition-all ${
              searchMode === "number"
                ? "border-purple-700 bg-purple-700 text-white"
                : "border-purple-200 text-purple-700 hover:border-purple-400 bg-white"
            }`}
          >
            <FileText size={14} />
            Booking #
          </button>
        </div>
      )}

      {/* Mode: Booking Number */}
      {!selectedTrip && !matchedPassenger && searchMode === "number" && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. 26-0001"
              className="flex-1 px-4 py-3 bg-white border border-purple-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 uppercase"
              value={bookingNumber}
              onChange={(e) => setBookingNumber(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && bookingNumber.trim()) {
                  lookupMutation.mutate(bookingNumber.trim());
                }
              }}
            />
            <button
              type="button"
              onClick={() => lookupMutation.mutate(bookingNumber.trim())}
              disabled={!bookingNumber.trim() || lookupMutation.isPending}
              className="px-5 py-3 bg-purple-600 text-white text-sm font-semibold rounded-xl hover:bg-purple-700 disabled:opacity-40 transition-colors whitespace-nowrap"
            >
              {lookupMutation.isPending ? "Looking up…" : "Look Up"}
            </button>
          </div>
        </div>
      )}

      {/* Mode: Passenger Name Search → Show ALL trips */}
      {!selectedTrip && !matchedPassenger && searchMode === "passenger" && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Passenger name (e.g. John Smith)"
              className="flex-1 px-4 py-3 bg-white border border-purple-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              value={passengerSearch}
              onChange={(e) => setPassengerSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && passengerSearch.trim().length >= 2) {
                  passengerSearchMutation.mutate(passengerSearch.trim());
                }
              }}
              autoFocus
            />
            <button
              type="button"
              onClick={() =>
                passengerSearchMutation.mutate(passengerSearch.trim())
              }
              disabled={
                passengerSearch.trim().length < 2 ||
                passengerSearchMutation.isPending
              }
              className="px-5 py-3 bg-purple-600 text-white text-sm font-semibold rounded-xl hover:bg-purple-700 disabled:opacity-40 transition-colors whitespace-nowrap flex items-center gap-2"
            >
              {passengerSearchMutation.isPending && (
                <Loader2 size={14} className="animate-spin" />
              )}
              {passengerSearchMutation.isPending ? "Searching…" : "Search"}
            </button>
          </div>
          <p className="text-xs text-gray-400 pl-1">
            Also searches by phone or email
          </p>
        </div>
      )}

      {/* Show ALL trips for matched passenger */}
      {!selectedTrip && matchedPassenger && allTrips.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">
              {allTrips.length} trip(s) for {matchedPassenger.name}
            </h3>
            <button
              type="button"
              onClick={() => {
                setMatchedPassenger(null);
                setAllTrips([]);
                setPassengerSearch("");
              }}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              ← New Search
            </button>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {allTrips.map((trip) => {
              const pickupAddr =
                trip.pickup_address ||
                `${trip.pickup_street || ""}, ${trip.pickup_city || ""}`.trim() ||
                "No pickup address";
              const dropoffAddr =
                trip.dropoff_address ||
                `${trip.dropoff_street || ""}, ${trip.dropoff_city || ""}`.trim() ||
                trip.destination ||
                "No destination";

              return (
                <button
                  key={trip.id}
                  onClick={() => handleSelectTripFromList(trip)}
                  className="w-full text-left p-4 rounded-xl border-2 border-gray-200 hover:border-purple-500 hover:bg-purple-50 transition-all"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-purple-600">
                        Trip #{trip.booking_number || trip.id}
                      </span>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          trip.status === "completed"
                            ? "bg-green-100 text-green-700"
                            : trip.status === "confirmed"
                              ? "bg-blue-100 text-blue-700"
                              : trip.status === "pending"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {trip.status}
                      </span>
                    </div>
                    <ArrowRight size={16} className="text-gray-400" />
                  </div>

                  {/* Client: name on the left, phone on the right */}
                  {(trip.client_name || trip.client_phone) && (
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-gray-800">
                        {trip.client_name || "Unknown"}
                      </span>
                      {trip.client_phone && (
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Phone size={11} />
                          {trip.client_phone}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar size={14} />
                      <span>
                        {format(
                          new Date(trip.start_time),
                          "MMM d, yyyy 'at' h:mm a",
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <MapPin size={14} className="text-green-600 mt-0.5" />
                      <span className="text-gray-700 truncate">
                        <span className="font-medium">Pickup:</span>{" "}
                        {pickupAddr}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <MapPin size={14} className="text-red-600 mt-0.5" />
                      <span className="text-gray-700 truncate">
                        <span className="font-medium">Dropoff:</span>{" "}
                        {dropoffAddr}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="font-semibold text-gray-700">
                        Services:
                      </span>{" "}
                      {(trip.appointment_services || trip.services)
                        .map((s) => s.service_name || "Service")
                        .join(", ")}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected trip confirmation */}
      {selectedTrip && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-purple-700">
              ✓ #{selectedTrip.booking_number || selectedTrip.id} selected
            </span>
            <button
              type="button"
              onClick={() => {
                setSelectedTrip(null);
                setUseHomeForPickup(false);
                setUseHomeForDropoff(false);
              }}
              className="text-gray-400 hover:text-gray-600 text-xs font-medium"
            >
              Change
            </button>
          </div>

          {/* Show cloned data summary */}
          <div className="space-y-1.5 text-xs text-gray-600">
            {(selectedTrip.client_name || selectedTrip.client_phone) && (
              <div className="flex items-center justify-between">
                <span>
                  <span className="font-semibold text-gray-700">
                    Passenger:
                  </span>{" "}
                  {selectedTrip.client_name || "Unknown"}
                </span>
                {selectedTrip.client_phone && (
                  <span className="text-gray-500 flex items-center gap-1">
                    <Phone size={11} />
                    {selectedTrip.client_phone}
                  </span>
                )}
              </div>
            )}
            {(selectedTrip.pickup_street || selectedTrip.pickup_address) && (
              <p>
                <span className="font-semibold text-gray-700">Pickup:</span>{" "}
                {selectedTrip.pickup_street || selectedTrip.pickup_address}
              </p>
            )}
            {(selectedTrip.dropoff_street ||
              selectedTrip.dropoff_address ||
              selectedTrip.destination) && (
              <p>
                <span className="font-semibold text-gray-700">Dropoff:</span>{" "}
                {selectedTrip.dropoff_street ||
                  selectedTrip.dropoff_address ||
                  selectedTrip.destination}
              </p>
            )}
            {(selectedTrip.appointment_services?.length > 0 ||
              selectedTrip.services?.length > 0) && (
              <p>
                <span className="font-semibold text-gray-700">Services:</span>{" "}
                {(selectedTrip.appointment_services || selectedTrip.services)
                  .map((s) => s.service_name || "Service")
                  .join(", ")}
              </p>
            )}
            {selectedTrip.payment_method && (
              <p>
                <span className="font-semibold text-gray-700">Payment:</span>{" "}
                {selectedTrip.payment_method}
              </p>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <Home size={14} className="text-blue-700" />
              <p className="text-xs font-semibold text-blue-900">
                Use passenger's HOME address instead?
              </p>
            </div>

            {loadingHomeAddress && (
              <div className="flex items-center gap-2 text-xs text-blue-600">
                <Loader2 size={12} className="animate-spin" />
                <span>Checking home address...</span>
              </div>
            )}

            {!loadingHomeAddress && !hasPassengerAddress && (
              <div className="bg-amber-50 border border-amber-200 rounded px-2 py-1.5 mb-2">
                <p className="text-xs text-amber-700">
                  ⚠️ No home address on file for this passenger
                </p>
              </div>
            )}

            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={useHomeForPickup}
                onChange={(e) => setUseHomeForPickup(e.target.checked)}
                disabled={!hasPassengerAddress || loadingHomeAddress}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              />
              <span
                className={`text-xs transition-colors ${
                  hasPassengerAddress && !loadingHomeAddress
                    ? "text-blue-800 group-hover:text-blue-900"
                    : "text-gray-400"
                }`}
              >
                Use HOME for <strong>pickup</strong>
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={useHomeForDropoff}
                onChange={(e) => setUseHomeForDropoff(e.target.checked)}
                disabled={!hasPassengerAddress || loadingHomeAddress}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              />
              <span
                className={`text-xs transition-colors ${
                  hasPassengerAddress && !loadingHomeAddress
                    ? "text-blue-800 group-hover:text-blue-900"
                    : "text-gray-400"
                }`}
              >
                Use HOME for <strong>dropoff</strong>
              </span>
            </label>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-800 font-medium">
            ✏️ All trip details will be copied. You'll need to set a new date &
            time. Review each field before saving.
          </div>

          <button
            type="button"
            onClick={handleContinue}
            className="w-full py-3 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 transition-colors"
          >
            Continue with This Trip
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-3">
        {!selectedTrip && !matchedPassenger && (
          <button
            type="button"
            onClick={onSkip}
            className="w-full py-3 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Skip – Start with Empty Form
          </button>
        )}
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

export default TripCloneSection;
