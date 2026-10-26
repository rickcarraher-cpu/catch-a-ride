"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  PASSENGER_BOOKING_STEPS,
  INITIAL_FORM,
} from "@/components/BookingWizard/constants";
import { StepCard } from "@/components/BookingWizard/StepCard";
import { WizardHeader } from "@/components/BookingWizard/WizardHeader";
import { WizardNavigation } from "@/components/BookingWizard/WizardNavigation";
import { WelcomeScreen } from "@/components/BookingWizard/WelcomeScreen";
import { IntentSelection } from "@/components/BookingWizard/IntentSelection";
import { SendMessageScreen } from "@/components/BookingWizard/SendMessageScreen";
import { AfterHoursModal } from "@/components/BookingWizard/AfterHoursModal";
import { Step1Name } from "@/components/BookingWizard/Steps/Step1Name";
import { Step2TripType } from "@/components/BookingWizard/Steps/Step2TripType";
import { Step3DateTime } from "@/components/BookingWizard/Steps/Step3DateTime";
import { Step3_5PassengersBaggage } from "@/components/BookingWizard/Steps/Step3_5PassengersBaggage";
import { Step4Location } from "@/components/BookingWizard/Steps/Step4Location";
import { Step6Details } from "@/components/BookingWizard/Steps/Step6Details";
import { Step7Addons } from "@/components/BookingWizard/Steps/Step7Addons";
import { Step9Review } from "@/components/BookingWizard/Steps/Step9Review";
import { usePassengerLookup } from "@/hooks/usePassengerLookup";
import { useBookingSubmit } from "@/hooks/useBookingSubmit";
import { canProceedToNextStep } from "@/components/BookingWizard/validation";
import { getValidationErrors } from "@/components/BookingWizard/validation";

function BookWizard({ slug }) {
  // Screen state: null (loading) | "afterhours" | "welcome" | "intent" | "message" | "booking" | "done"
  const [screen, setScreen] = useState(null);
  const [step, setWizardStep] = useState(1);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [bookingResult, setBookingResult] = useState(null);
  const [validationErrors, setValidationErrors] = useState([]);
  const [hasAttempted, setHasAttempted] = useState(false);

  const set = (partial) => setFormData((prev) => ({ ...prev, ...partial }));

  // Pass onPassengerFound so formData is populated when a profile is found
  const lookup = usePassengerLookup((client) => {
    // Build full address from components
    const fullAddress = [
      client.street_address,
      client.city,
      client.state,
      client.zip_code,
    ]
      .filter(Boolean)
      .join(", ");

    set({
      name: client.name || "",
      phone: client.phone || "",
      email: client.email || "",
      notification_preference: client.notification_preference || "both",
      pickup: fullAddress || INITIAL_FORM.pickup,
      pickup_street: client.street_address || null,
      pickup_city: client.city || null,
      pickup_state: client.state || null,
      pickup_zip: client.zip_code || null,
      client_id: client.id || null,
      home_street: client.street_address || null,
      home_city: client.city || null,
      home_state: client.state || null,
      home_zip: client.zip_code || null,
      cc_emails: client.cc_emails || "",
    });
  });

  // Settings - needed for rate_per_mile auto-price calculation and welcome screen toggle
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ["booking-page-settings"],
    queryFn: async () => {
      const res = await fetch("/api/settings");
      if (!res.ok) throw new Error("Failed to fetch settings");
      const data = await res.json();
      if (data && typeof data === "object" && !Array.isArray(data)) {
        return data;
      }
      const obj = {};
      if (Array.isArray(data)) {
        data.forEach((r) => {
          obj[r.key] = r.value;
        });
      }
      return obj;
    },
    staleTime: 0, // Always fetch fresh settings (especially for business hours)
    refetchOnWindowFocus: true, // Refetch when user returns to tab
    retry: false,
  });

  // Once settings load, set the initial screen to "afterhours" (always show this first)
  useEffect(() => {
    if (!settingsLoading && screen === null) {
      setScreen("afterhours");
    }
  }, [settingsLoading, screen]);

  const { data: services } = useQuery({
    queryKey: ["booking-services"],
    queryFn: async () => {
      const res = await fetch("/api/services");
      if (!res.ok) throw new Error("Failed to fetch services");
      return res.json();
    },
    select: (data) =>
      data
        .filter((s) => s.is_active && !s.is_addon)
        .sort((a, b) => a.display_order - b.display_order),
  });

  const { data: addons } = useQuery({
    queryKey: ["booking-addons"],
    queryFn: async () => {
      const res = await fetch("/api/services");
      if (!res.ok) throw new Error("Failed to fetch services");
      return res.json();
    },
    select: (data) => data.filter((s) => s.is_active && s.is_addon),
  });

  // ── Service detection helpers (mirrors dispatch wizard) ───────────────────
  const detectService = (pickupAddr, dropoffAddr) => {
    if (!services) return null;
    const pickup = pickupAddr.toLowerCase();
    const dropoff = dropoffAddr.toLowerCase();

    const preferredLabel = (
      formData.pickup_preferred_label ||
      formData.dropoff_preferred_label ||
      ""
    ).toLowerCase();
    if (preferredLabel) {
      const found = services.find((s) => {
        const sName = s.name.toLowerCase();
        return (
          preferredLabel.includes(sName) ||
          sName
            .split(" ")
            .some((word) => word.length > 3 && preferredLabel.includes(word))
        );
      });
      if (found) return found;
    }

    // Check if this looks like BNA Hilton (hotel shares airport ZIP 37214)
    const combinedAddr = `${pickup} ${dropoff}`;
    const isBNAHilton = combinedAddr.includes("hilton");

    let name;
    if (
      pickup.includes("terminal") ||
      dropoff.includes("terminal") ||
      pickup.includes("airport") ||
      dropoff.includes("airport") ||
      (!isBNAHilton && (pickup.includes("37214") || dropoff.includes("37214")))
    ) {
      name = "BNA";
    } else if (
      pickup.includes("broadway") ||
      dropoff.includes("broadway") ||
      pickup.includes("downtown") ||
      dropoff.includes("downtown") ||
      pickup.includes("37203") ||
      dropoff.includes("37203")
    ) {
      name = "Downtown";
    } else if (
      pickup.includes("rock springs") ||
      dropoff.includes("rock springs") ||
      pickup.includes("castilian") ||
      dropoff.includes("castilian") ||
      pickup.includes("37031") ||
      dropoff.includes("37031")
    ) {
      name = "The Farm";
    } else {
      name = "Custom";
    }

    return (
      services.find((s) => s.name.toLowerCase().includes(name.toLowerCase())) ||
      null
    );
  };

  const applyDetectedServicePricing = async (
    detectedService,
    pickupAddr,
    dropoffAddr,
  ) => {
    if (!detectedService) return;
    // For passenger bookings, always use the default_price (never leave it blank)
    // Passengers don't set their own prices - that's handled by admin/dispatch
    set({
      service_id: detectedService.id,
      service_price: String(detectedService.default_price || 0),
    });
  };
  // ─────────────────────────────────────────────────────────────────────────

  const selectedService = services?.find((s) => s.id == formData.service_id);
  const isAirport = selectedService?.is_airport_service || false;

  // Pass "Online" as bookedBy so trips show "Booked by Online"
  const submitMutation = useBookingSubmit(
    services,
    addons,
    setValidationErrors,
    setBookingResult,
    () => setScreen("done"),
    "Online",
  );

  const canProceed = canProceedToNextStep(step, formData, isAirport);
  const currentValidationErrors = getValidationErrors(
    step,
    formData,
    isAirport,
  );

  // Ref-based guard to prevent double-submit (isPending has a small timing gap)
  const isSubmittingRef = useRef(false);

  const goNext = async () => {
    setHasAttempted(true);
    if (!canProceedToNextStep(step, formData, isAirport)) return;
    if (step < PASSENGER_BOOKING_STEPS.length) {
      setHasAttempted(false); // reset for next step

      // Step 5 (Location) → auto-detect service, then go to Step 6 (Details)
      if (step === 5 && services) {
        const pickupAddr =
          `${formData.pickup_street || ""}, ${formData.pickup_city || ""}, ${formData.pickup_state || ""} ${formData.pickup_zip || ""}`.trim();
        const dropoffAddr =
          `${formData.dropoff_street || ""}, ${formData.dropoff_city || ""}, ${formData.dropoff_state || ""} ${formData.dropoff_zip || ""}`.trim();
        let svc = detectService(pickupAddr, dropoffAddr);
        // Fallback: if no service detected, use "Custom" or first available service
        if (!svc && services.length > 0) {
          svc =
            services.find((s) => s.name.toLowerCase().includes("custom")) ||
            services[0];
        }
        await applyDetectedServicePricing(svc, pickupAddr, dropoffAddr);
        setTimeout(() => {
          setWizardStep(6);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }, 50);
        return;
      }
      setWizardStep((s) => s + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const goPrev = () => {
    setHasAttempted(false);
    if (step > 1) {
      // Step 6 (Details) → go back to Step 5 (Location)
      if (step === 6) {
        setWizardStep(5);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      setWizardStep((s) => s - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleSubmit = () => {
    if (submitMutation.isPending || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    submitMutation.mutate(formData, {
      onSettled: () => {
        isSubmittingRef.current = false;
      },
    });
  };

  const handleCancel = () => {
    // Reset form to initial state to prevent browser's "unsaved changes" warning
    setFormData(INITIAL_FORM);
    setWizardStep(1);

    // Small delay to let the form reset before closing
    setTimeout(() => {
      if (typeof window !== "undefined") {
        window.close();
        // If window.close() doesn't work (not opened by script), go back
        setTimeout(() => {
          window.history.back();
        }, 100);
      }
    }, 50);
  };

  // Show loading screen while settings are being fetched
  if (settingsLoading || screen === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <div className="text-xl font-semibold">Loading...</div>
        </div>
      </div>
    );
  }

  // After-hours modal - ALWAYS SHOWS FIRST
  if (screen === "afterhours") {
    return (
      <AfterHoursModal
        onContinue={() => {
          // After dismissing after-hours modal, go to welcome (if enabled) or intent
          if (settings?.require_welcome_screen === "yes") {
            setScreen("welcome");
          } else {
            setScreen("intent");
          }
        }}
        settings={settings}
      />
    );
  }

  // Welcome screen - both buttons now go to intent selection
  if (screen === "welcome") {
    return (
      <WelcomeScreen settings={settings} onStart={() => setScreen("intent")} />
    );
  }

  if (screen === "intent") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl">
          <IntentSelection
            onBookTrip={() => {
              setScreen("booking");
            }}
            onSendMessage={() => {
              setScreen("message");
            }}
          />
        </div>
      </div>
    );
  }

  if (screen === "message") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl">
          <StepCard step={1}>
            <SendMessageScreen
              onBack={() => {
                setScreen("intent");
              }}
              onSuccess={(result) => {
                setBookingResult(result);
                setScreen("done");
              }}
            />
          </StepCard>
        </div>
      </div>
    );
  }

  if (screen === "booking") {
    const submissionErrorMessage = submitMutation.isError
      ? submitMutation.error?.message !== "Validation failed"
        ? submitMutation.error?.message || "Booking failed. Please try again."
        : null
      : null;

    // Only show validation errors after user has tried to advance
    const visibleValidationErrors = hasAttempted ? currentValidationErrors : [];

    const renderStep = () => {
      switch (step) {
        case 1:
          return (
            <Step1Name
              formData={formData}
              set={set}
              onNext={goNext}
              canProceed={canProceed}
              lookupType={lookup.lookupType}
              setLookupType={lookup.setLookupType}
              lookupValue={lookup.lookupValue}
              setLookupValue={lookup.setLookupValue}
              lookupStatus={lookup.lookupStatus}
              setLookupStatus={lookup.setLookupStatus}
              lookupMutation={lookup.lookupMutation}
              isPassengerMode={true}
              allMatches={lookup.allMatches}
              matchIndex={lookup.matchIndex}
              nextMatch={lookup.nextMatch}
              prevMatch={lookup.prevMatch}
            />
          );
        case 2:
          return <Step2TripType formData={formData} set={set} />;
        case 3:
          return (
            <Step3DateTime
              formData={formData}
              set={set}
              addons={addons}
              settings={settings}
            />
          );
        // NEW: Passengers & Baggage step
        case 4:
          return (
            <Step3_5PassengersBaggage
              formData={formData}
              set={set}
              isPassengerMode={true}
            />
          );
        case 5:
          return (
            <Step4Location
              formData={formData}
              set={set}
              lookupMutation={lookup.lookupMutation}
              isPassengerMode={true}
            />
          );
        // case service selection is skipped — auto-detected from location
        // Step 6: Details
        case 6:
          return (
            <Step6Details formData={formData} set={set} isAirport={isAirport} />
          );
        // Step 7: Add-ons
        case 7:
          return (
            <Step7Addons
              formData={formData}
              set={set}
              addons={addons}
              isPassengerMode={true}
            />
          );
        // Step 8: Review — Submit shows here (matches STEPS.length = 8)
        case 8:
          return (
            <Step9Review
              formData={formData}
              set={set}
              selectedService={selectedService}
              addons={addons}
              validationErrors={validationErrors}
              isPassengerMode={true}
            />
          );
        default:
          return null;
      }
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <WizardHeader
          settings={settings}
          step={step}
          slug={slug}
          steps={PASSENGER_BOOKING_STEPS}
        />
        <main className="flex justify-center px-4 pt-8 pb-24">
          <StepCard step={step} steps={PASSENGER_BOOKING_STEPS}>
            {renderStep()}
            <WizardNavigation
              step={step}
              totalSteps={PASSENGER_BOOKING_STEPS.length}
              onPrev={goPrev}
              onNext={goNext}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              canProceed={canProceed}
              isSubmitting={submitMutation.isPending}
              currentStepInfo={PASSENGER_BOOKING_STEPS.find(
                (s) => s.id === step,
              )}
              submissionErrorMessage={submissionErrorMessage}
              validationErrors={visibleValidationErrors}
            />
          </StepCard>
        </main>
      </div>
    );
  }

  if (screen === "done") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center px-4">
        <div className="bg-white rounded-3xl shadow-2xl p-12 text-center max-w-md w-full">
          <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-12 h-12 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="text-3xl font-extrabold text-gray-900 mb-3">
            {bookingResult?.client_name
              ? "Message Sent!"
              : "Booking Request Submitted"}
          </h2>
          {bookingResult?.booking_number && (
            <div className="text-4xl font-black text-emerald-600 mb-3">
              #{bookingResult.booking_number}
            </div>
          )}
          <p className="text-gray-700 text-lg mb-2">
            {bookingResult?.client_name
              ? "Thank you for your message. We'll get back to you soon!"
              : "Your request has been received and is pending review."}
          </p>
          <p className="text-gray-500 text-sm">
            {bookingResult?.client_name
              ? "We appreciate your inquiry."
              : "You will hear back from us once we review your booking request. Thank you."}
          </p>
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-400">
              This window will close automatically...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default function BookPage({ params }) {
  const slug = params?.slug || "catch-a-ride";
  return <BookWizard slug={slug} />;
}
