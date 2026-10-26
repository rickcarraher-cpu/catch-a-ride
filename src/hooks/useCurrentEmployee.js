import { useQuery } from "@tanstack/react-query";
import useUser from "@/utils/useUser";
import { useMemo } from "react";

/**
 * Hook to get the current employee/driver data for the logged-in user.
 * Handles both cases:
 * - Driver users with employee records
 * - Admin users without employee records
 */
export function useCurrentEmployee() {
  const { data: user } = useUser();

  const {
    data: empData,
    isLoading,
    error,
  } = useQuery({
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
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30,
    retry: false,
    enabled: !!user, // Only fetch when user is logged in
  });

  // Derive employee from empData, handling both employee records and admin users
  const employee = useMemo(() => {
    if (!empData) return null;
    if (empData.employee) return empData.employee;
    if (empData.isAdmin) {
      // Admin user without employee record - create minimal employee object
      return {
        is_admin: true,
        name: user?.name || "Admin",
        email: user?.email || "",
      };
    }
    return null;
  }, [empData, user]);

  return {
    employee,
    isLoading,
    error,
    isAdmin: employee?.is_admin === true,
  };
}
