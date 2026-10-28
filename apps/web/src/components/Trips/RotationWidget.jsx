import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, CheckCheck } from "lucide-react";
import { toast } from "sonner";

export function RotationWidget({ onAccept }) {
  const queryClient = useQueryClient();
  const { data: rotation, isLoading } = useQuery({
    queryKey: ["rotation"],
    queryFn: () => fetch("/api/rotation").then((r) => r.json()),
  });
  const actionMutation = useMutation({
    mutationFn: (action) =>
      fetch("/api/rotation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries(["rotation"]),
  });
  if (isLoading) return null;
  if (!rotation?.next) return null;
  const { next, drivers } = rotation;
  const total = drivers?.length || 0;
  const pos = drivers?.findIndex((d) => d.id === next.id) + 1 || 1;
  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center gap-4">
      <div className="flex items-center gap-2 shrink-0">
        <RotateCcw size={16} className="text-blue-500" />
        <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
          Next Driver
        </span>
        <span className="text-xs text-blue-400 font-medium">
          #{pos} of {total}
        </span>
      </div>
      <div className="flex items-center gap-3 flex-1">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
          style={{ backgroundColor: next.color }}
        >
          {next.name.charAt(0)}
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">{next.name}</p>
          <p className="text-xs text-gray-500">
            Rotation #{next.rotation_order}
          </p>
        </div>
      </div>
      {total > 1 && (
        <div className="hidden md:flex items-center gap-1.5">
          <span className="text-xs text-gray-400 mr-1">Up next:</span>
          {drivers?.slice(0, 4).map((d) => (
            <div
              key={d.id}
              title={d.name}
              className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold border-2 border-white shadow-sm ${d.id === next.id ? "ring-2 ring-blue-400" : ""}`}
              style={{ backgroundColor: d.color }}
            >
              {d.name.charAt(0)}
            </div>
          ))}
          {total > 4 && (
            <span className="text-xs text-gray-400">+{total - 4}</span>
          )}
        </div>
      )}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => actionMutation.mutate("skip")}
          disabled={actionMutation.isPending}
          className="px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
        >
          Skip
        </button>
        <button
          onClick={() => toast.info(`${next.name} kept as next driver`)}
          className="px-3 py-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Keep
        </button>
        <button
          onClick={() => {
            onAccept(next);
            actionMutation.mutate("accept");
          }}
          disabled={actionMutation.isPending}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <CheckCheck size={13} />
          Accept
        </button>
      </div>
    </div>
  );
}
