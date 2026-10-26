import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useSettings() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const res = await fetch("/api/settings");
      return res.json();
    },
    staleTime: 1000 * 30, // 30 seconds — fresh enough without refetching on every focus
    refetchOnWindowFocus: false,
  });

  const mutation = useMutation({
    mutationFn: async ({ key, value }) => {
      console.log(`[Settings] Saving ${key} = ${value}`);
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      if (!res.ok) throw new Error("Failed to save setting");
      const result = await res.json();
      console.log(`[Settings] Save result:`, result);
      return result;
    },
    onSuccess: () => {
      // Invalidate both settings query keys so booking wizard also gets fresh settings
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      queryClient.invalidateQueries({ queryKey: ["booking-page-settings"] });
      toast.success("Setting updated");
    },
    onError: (err) => {
      console.error(`[Settings] Save error:`, err);
      toast.error(err.message || "Failed to save setting");
    },
  });

  const handleUpdate = (key, value) => {
    mutation.mutate({ key, value });
  };

  return { settings, isLoading, handleUpdate };
}
