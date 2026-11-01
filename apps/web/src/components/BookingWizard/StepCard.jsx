export function StepCard({ step, children, steps }) {
  const currentStepInfo = steps ? steps.find((s) => s.id === step) : null;
  const Icon = currentStepInfo?.icon;

  return (
    <div className="w-full max-w-lg">
      {/* Floating step icon badge */}
      {Icon && (
        <div className="flex justify-center mb-5">
          <div
            className={`inline-flex w-14 h-14 rounded-2xl bg-gradient-to-br ${currentStepInfo?.gradient} items-center justify-center shadow-2xl ring-4 ring-white/10`}
          >
            <Icon size={26} className="text-white drop-shadow" />
          </div>
        </div>
      )}

      {/* Card */}
      <div className="bg-white rounded-3xl shadow-[0_32px_64px_rgba(0,0,0,0.25)] border border-gray-200">
        {/* Colored top stripe */}
        {currentStepInfo?.gradient && (
          <div
            className={`h-1.5 bg-gradient-to-r ${currentStepInfo.gradient} rounded-t-3xl`}
          />
        )}
        <div className="p-6 md:p-8 space-y-5">{children}</div>
      </div>
    </div>
  );
}
