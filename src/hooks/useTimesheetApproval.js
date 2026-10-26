import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useTimesheetApproval({ report, customStart, customEnd }) {
  const queryClient = useQueryClient();

  const approvalMutation = useMutation({
    mutationFn: async ({ employeeId, approved, reason }) => {
      const tripIds =
        report?.drivers
          ?.find((d) => d.driver.id === employeeId)
          ?.trips?.map((t) => t.id) || [];

      const res = await fetch("/api/timesheets/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId,
          startDate: customStart,
          endDate: customEnd,
          approved,
          reason: reason || "",
          role: "admin",
          adminName: "Admin",
          tripIds,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to submit approval");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timesheets"] });
    },
  });

  const handleApprove = (employeeId) => {
    approvalMutation.mutate({ employeeId, approved: true, reason: "" });
  };

  const handleReject = (employeeId) => {
    const reason = prompt("Reason for rejection:");
    if (!reason) return;
    approvalMutation.mutate({ employeeId, approved: false, reason });
  };

  return {
    handleApprove,
    handleReject,
    isApproving: approvalMutation.isPending,
  };
}
