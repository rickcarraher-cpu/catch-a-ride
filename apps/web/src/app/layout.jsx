// Catch A Ride – Root Layout (v2)
// Build: 2026-09-14
"use client";

import { useState, useEffect, useRef } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SystemMessageProvider } from "../components/SystemMessageModal";

import MainLayout from "../components/MainLayout";
import DailyBackupNotification from "../components/DailyBackupNotification";

const PUBLIC_PATHS = [
  "/account",
  "/book",
  "/book-wizard",
  "/booking",
  "/driver",
  "/docs",
  "/landing",
  "/passenger",
  "/pay",
  "/payment-complete",
  "/schedule-builder",
];

function getIsPublicPage() {
  if (typeof window === "undefined") return true;
  const path = window.location.pathname;
  if (path === "/") return true;
  return PUBLIC_PATHS.some((p) => path.startsWith(p));
}

export default function RootLayout({ children }) {
  const queryClientRef = useRef(null);
  if (!queryClientRef.current) {
    queryClientRef.current = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 0,
          gcTime: 1000 * 60 * 30,
          retry: 1,
          refetchOnWindowFocus: false,
        },
      },
    });
  }

  // Initialize synchronously so we never flip from true→false and cause a remount
  const [isPublicPage, setIsPublicPage] = useState(() => {
    if (typeof window === "undefined") return false; // SSR: treat as private (hydration suppressed)
    return getIsPublicPage();
  });

  useEffect(() => {
    // Listen for route changes so layout updates when navigating
    // between public and private pages (e.g. back button from /driver/portal)
    const handlePopState = () => {
      setIsPublicPage(getIsPublicPage());
    };

    // Also watch for pushState/replaceState navigation
    const origPush = history.pushState;
    const origReplace = history.replaceState;
    history.pushState = function () {
      origPush.apply(this, arguments);
      setIsPublicPage(getIsPublicPage());
    };
    history.replaceState = function () {
      origReplace.apply(this, arguments);
      setIsPublicPage(getIsPublicPage());
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      history.pushState = origPush;
      history.replaceState = origReplace;
    };
  }, []);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          rel="icon"
          href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%231D4ED8'/%3E%3Ctext x='16' y='23' font-family='Arial' font-size='18' font-weight='bold' fill='white' text-anchor='middle'%3EC%3C/text%3E%3C/svg%3E"
          type="image/svg+xml"
        />
        <link
          rel="shortcut icon"
          href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%231D4ED8'/%3E%3Ctext x='16' y='23' font-family='Arial' font-size='18' font-weight='bold' fill='white' text-anchor='middle'%3EC%3C/text%3E%3C/svg%3E"
          type="image/svg+xml"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <style>{`
          @media print {
            aside, header, .no-print { display: none !important; }
            main { margin-left: 0 !important; padding-top: 0 !important; }
            body { background: white !important; }
          }
        `}</style>
      </head>
      <body
        className="font-inter antialiased bg-white text-gray-900"
        suppressHydrationWarning
      >
        <QueryClientProvider client={queryClientRef.current}>
          <SystemMessageProvider>
            {isPublicPage ? (
              children
            ) : (
              <>
                <MainLayout>{children}</MainLayout>
                <DailyBackupNotification />
              </>
            )}
          </SystemMessageProvider>
        </QueryClientProvider>
      </body>
    </html>
  );
}
