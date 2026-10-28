import { useQuery } from "@tanstack/react-query";

export function useDrivers() {
  const {
    data: drivers,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const res = await fetch("/api/employees");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to fetch drivers");
      }
      return res.json();
    },
    staleTime: 0,
    retry: 2,
  });

  return {
    drivers,
    isLoading,
    error,
  };
}
