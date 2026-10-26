"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import TenantSwitcher from "@/components/TenantSwitcher";

const CACHE_KEY = "car_query_cache";
const CACHE_TTL = 15 * 60 * 1000;

function saveToSession(queryKey, data) {
  if (typeof window === "undefined") return;
  try {
    const cache = JSON.parse(sessionStorage.getItem(CACHE_KEY) || "{}");
    cache[JSON.stringify(queryKey)] = { data, ts: Date.now() };
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (e) {}
}

function deferSaveToSession(queryKey, data) {
  if (typeof window === "undefined") return;
  const doSave = () => saveToSession(queryKey, data);
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(doSave, { timeout: 3000 });
  } else {
    setTimeout(doSave, 500);
  }
}

function hydrateFromSession(queryClient) {
  if (typeof window === "undefined") return false;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return false;
    const cache = JSON.parse(raw);
    let hydrated = false;
    const now = Date.now();
    for (const [keyStr, entry] of Object.entries(cache)) {
      if (now - entry.ts < CACHE_TTL && entry.data) {
        queryClient.setQueryData(JSON.parse(keyStr), entry.data);
        hydrated = true;
      }
    }
    return hydrated;
  } catch (e) {
    return false;
  }
}

export default function MainLayout({ children }) {
  const queryClient = useQueryClient();
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(true);

  const hydratedRef = useRef(false);

  useEffect(() => {
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      hydrateFromSession(queryClient);
    }
  }, []);

  // Use React Query for auth check — shared cache with Dashboard via "current-employee" key
  const { data: empData, isLoading: empLoading } = useQuery({
    queryKey: ["current-employee"],
    queryFn: async () => {
      const res = await fetch("/api/driver/employee");
      if (!res.ok) {
        const err = new Error("Employee fetch failed");
        err.status = res.status;
        throw err;
      }
      return res.json();
    },
    staleTime: 1000 * 60 * 5, // 5 minutes — don't re-fetch on every mount/focus
    gcTime: 1000 * 60 * 30,
    retry: false,
  });

  // Check bypass setting via settings query (also cached)
  const { data: settingsForAuth } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const res = await fetch("/api/settings");
      if (!res.ok) throw new Error("Failed to load settings");
      return res.json();
    },
    staleTime: 1000 * 30,
    gcTime: 1000 * 60 * 30,
  });

  useEffect(() => {
    // Bypass enabled → always treat as admin
    if (settingsForAuth?.bypass_dashboard_login === "yes") {
      setAuthChecked(true);
      setIsAdmin(true);
      return;
    }
    // Employee data loaded
    if (!empLoading && empData) {
      // Handle both cases: employee record exists OR admin without employee record
      if (empData.employee) {
        setIsAdmin(empData.employee.is_admin !== false);
      } else if (empData.isAdmin) {
        // Admin user without employee record
        setIsAdmin(true);
      } else {
        // Not an admin and no employee record
        setIsAdmin(false);
      }
      setAuthChecked(true);
      return;
    }
    // If employee query finished (even with error), mark auth as checked
    if (!empLoading) {
      setAuthChecked(true);
    }
  }, [empData, empLoading, settingsForAuth]);

  const { startISO, endISO } = useMemo(() => {
    const s = new Date();
    s.setMonth(s.getMonth() - 2);
    const e = new Date();
    e.setMonth(e.getMonth() + 2);
    return {
      startISO: s.toISOString().split("T")[0],
      endISO: e.toISOString().split("T")[0],
    };
  }, []);

  const fetchJson = async (url) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch ${url}`);
    return res.json();
  };

  const queries = useQueries({
    queries: [
      {
        queryKey: ["appointments"],
        queryFn: () =>
          fetchJson(`/api/appointments?start=${startISO}&end=${endISO}`),
        staleTime: 1000 * 60 * 15,
        gcTime: 1000 * 60 * 30,
      },
      {
        queryKey: ["clients"],
        queryFn: () => fetchJson("/api/clients"),
        staleTime: 1000 * 60 * 15,
        gcTime: 1000 * 60 * 30,
      },
      {
        queryKey: ["employees"],
        queryFn: () => fetchJson("/api/employees"),
        staleTime: 1000 * 60 * 15,
        gcTime: 1000 * 60 * 30,
      },
      {
        queryKey: ["vehicles"],
        queryFn: () => fetchJson("/api/vehicles"),
        staleTime: 1000 * 60 * 15,
        gcTime: 1000 * 60 * 30,
      },
      {
        queryKey: ["services"],
        queryFn: () => fetchJson("/api/services"),
        staleTime: 1000 * 60 * 15,
        gcTime: 1000 * 60 * 30,
      },
      {
        queryKey: ["blockedTimes"],
        queryFn: () => fetchJson("/api/blocked-times"),
        staleTime: 1000 * 60 * 15,
        gcTime: 1000 * 60 * 30,
      },
      {
        queryKey: ["settings"],
        queryFn: () => fetchJson("/api/settings"),
        staleTime: 1000 * 60 * 15,
        gcTime: 1000 * 60 * 30,
      },
      {
        queryKey: ["transactions"],
        queryFn: () => fetchJson("/api/transactions?category=payment"),
        staleTime: 1000 * 60 * 15,
        gcTime: 1000 * 60 * 30,
      },
    ],
  });

  const allLoaded = queries.every((q) => !q.isLoading);
  useEffect(() => {
    if (!allLoaded) return;
    // Skip saving appointments (index 0) to sessionStorage — too large and already cached by React Query
    const configs = [
      { idx: 1, key: ["clients"] },
      { idx: 2, key: ["employees"] },
      { idx: 3, key: ["vehicles"] },
      { idx: 4, key: ["services"] },
      { idx: 5, key: ["blockedTimes"] },
      { idx: 6, key: ["settings"] },
      { idx: 7, key: ["transactions"] },
    ];
    for (const { idx, key } of configs) {
      const data = queries[idx].data;
      if (data) deferSaveToSession(key, data);
    }
  }, [allLoaded]);

  // Esc key shortcut — pressing Escape scrolls to the top of the page.
  // Skips when a popup is open (so modals keep their own Esc-to-close
  // behavior) and while typing in a form field.
  useEffect(() => {
    const isPopupOpen = () => {
      // Tailwind-based modal overlays (trip editor, payment window, confirm dialogs, etc.)
      if (document.querySelector(".fixed.inset-0")) return true;
      // Inline-styled full-screen overlays (system messages, daily backup notice)
      const divs = document.querySelectorAll("div");
      for (let i = 0; i < divs.length; i++) {
        const cs = window.getComputedStyle(divs[i]);
        if (
          cs.position === "fixed" &&
          Number(cs.zIndex) >= 9999 &&
          cs.top === "0px" &&
          cs.left === "0px" &&
          cs.right === "0px" &&
          cs.bottom === "0px"
        ) {
          return true;
        }
      }
      return false;
    };

    const handleKeyDown = (e) => {
      if (e.key !== "Escape") return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      // Let any open popup handle Esc itself
      if (isPopupOpen()) return;
      // Don't hijack Esc while typing in a field
      const active = document.activeElement;
      const tag = active ? active.tagName : null;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        (active && active.isContentEditable)
      ) {
        return;
      }
      // Scroll to top of page
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* ── Main Content ── */}
      <main className="flex-1 bg-gray-50">
        <div className="p-4 md:p-8">
          {/* Tenant Switcher at top of all pages */}
          <div className="mb-4 flex justify-end">
            <TenantSwitcher />
          </div>
          <div>{children}</div>
        </div>
      </main>

      {/* Removed popup modals - using flashing dashboard buttons in QuickAccessBar instead */}
    </div>
  );
}
