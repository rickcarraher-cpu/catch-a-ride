/**
 * Dispatch Booking Wizard - Admin version of the booking wizard
 * Uses the exact same BookingWizardMain component as the online passenger flow,
 * but with isPassengerMode=false to show third-person language and admin-only fields
 */

import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/utils/notify";
import { ArrowLeft } from "lucide-react";
import { BookingWizardMain } from "@/components/BookingWizard/BookingWizardMain";

export function DispatchBookingWizard({
  trip = null,
  prefillData = null,
  clients = [],
  drivers = [],
  services = [],
  preselectedClientId = null,
  startAsTour = false,
  onClose,
  onSuccess,
}) {
  const queryClient = useQueryClient();
  const [enrichedPrefill, setEnrichedPrefill] = useState(prefillData);

  // Fetch settings
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const res = await fetch("/api/settings");
      return res.json();
    },
    staleTime: 0, // Always fetch fresh settings to ensure business hours are current
    refetchOnWindowFocus: true, // Refetch when user returns to tab
  });

  // Fetch preferred locations
  const { data: preferredLocations } = useQuery({
    queryKey: ["preferred-locations"],
    queryFn: async () => {
      const res = await fetch("/api/settings/preferred-locations");
      return res.json();
    },
  });

  // Fetch vehicles for admin options step
  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles"],
    queryFn: async () => {
      const res = await fetch("/api/vehicles");
      if (!res.ok) return [];
      return res.json();
    },
  });

  // If preselectedClientId is provided, fetch client details and build prefillData
  useEffect(() => {
    if (preselectedClientId && !prefillData) {
      const client = clients.find((c) => c.id === preselectedClientId);
      if (client) {
        setEnrichedPrefill({
          client_id: client.id,
          name: client.name,
          phone: client.phone || "",
          email: client.email || "",
          notification_preference: client.notification_preference || "both",
          street_address: client.street_address || null,
          city: client.city || null,
          state: client.state || null,
          zip_code: client.zip_code || null,
          pickup: client.street_address
            ? `${client.street_address}${client.city ? `, ${client.city}` : ""}${client.state ? `, ${client.state}` : ""}${client.zip_code ? ` ${client.zip_code}` : ""}`
            : null,
          pickup_street: client.street_address || null,
          pickup_city: client.city || null,
          pickup_state: client.state || null,
          pickup_zip: client.zip_code || null,
          home_street: client.street_address || null,
          home_city: client.city || null,
          home_state: client.state || null,
          home_zip: client.zip_code || null,
        });
      }
    } else if (prefillData && !enrichedPrefill) {
      setEnrichedPrefill(prefillData);
    }
  }, [preselectedClientId, prefillData, clients, enrichedPrefill]);

  const handleWizardSuccess = async () => {
    // Invalidate appointments cache
    await queryClient.invalidateQueries({ queryKey: ["appointments"] });

    // If a parent onSuccess callback is provided (e.g. called from schedule page),
    // use it instead of navigating away to the dashboard
    if (onSuccess) {
      onSuccess();
    } else {
      // Fallback: redirect to dashboard (used when opened standalone)
      window.location.href = "/dashboard";
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto my-8">
        {/* Back to Dashboard link */}
        <div className="p-6 pb-0">
          <a
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors"
          >
            <ArrowLeft size={16} />
            Back to Dashboard
          </a>
        </div>

        {/* Use the exact same wizard as online booking, but with dispatch mode */}
        <BookingWizardMain
          settings={settings}
          services={services}
          preferredLocations={preferredLocations}
          isPassengerMode={false} // KEY: Third-person language + admin fields
          drivers={drivers}
          vehicles={vehicles}
          onClose={onClose}
          onSuccess={handleWizardSuccess}
          prefillData={enrichedPrefill}
          startWithTour={startAsTour}
        />
      </div>
    </div>
  );
}
