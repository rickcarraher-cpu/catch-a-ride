"use client";

import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { BookingWizardMain } from "@/components/BookingWizard/BookingWizardMain";
import { SystemMessageProvider } from "@/components/SystemMessageModal";

const queryClient = new QueryClient();

function BookWizard({ slug }) {
  const [services, setServices] = useState([]);
  const [preferredLocations, setPreferredLocations] = useState([]);
  const [settings, setSettings] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch services
        const servicesRes = await fetch("/api/services");
        const servicesData = await servicesRes.json();
        setServices(servicesData);

        // Fetch preferred locations
        const locationsRes = await fetch("/api/settings/preferred-locations");
        const locationsData = await locationsRes.json();
        setPreferredLocations(locationsData);

        // Fetch settings
        const settingsRes = await fetch("/api/settings");
        const settingsData = await settingsRes.json();
        setSettings(settingsData);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="text-xl font-semibold">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <BookingWizardMain
      settings={settings}
      services={services}
      preferredLocations={preferredLocations}
    />
  );
}

export default function BookWizardPage({ params }) {
  const slug = params?.slug || "catch-a-ride";
  return (
    <QueryClientProvider client={queryClient}>
      <SystemMessageProvider>
        <div className="overflow-y-auto">
          <BookWizard slug={slug} />
        </div>
      </SystemMessageProvider>
    </QueryClientProvider>
  );
}
