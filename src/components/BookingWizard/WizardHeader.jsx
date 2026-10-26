import { Car, X, ChevronRight } from "lucide-react";

export function WizardHeader({ settings, step, slug, steps = [] }) {
  const totalSteps = steps.length;
  const pct = Math.round(((step - 1) / (totalSteps - 1)) * 100);
  const currentStepInfo = steps.find((s) => s.id === step);

  return (
    <header className="relative z-10">
      {/* Top bar */}
      <div className="backdrop-blur-xl bg-black/20 border-b border-white/10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {settings?.logo_url ? (
              <div className="w-9 h-9 rounded-xl bg-white/95 backdrop-blur flex items-center justify-center border border-white/20 p-1">
                <img
                  src={settings.logo_url}
                  alt="Logo"
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center border border-white/20">
                <Car size={18} className="text-white" />
              </div>
            )}
            <div>
              <p className="font-bold text-white text-sm leading-tight tracking-wide">
                {settings?.business_name || "Book A Ride"}
              </p>
              <p className="text-white/50 text-xs font-medium">
                Step {step} of {totalSteps} · {currentStepInfo?.label}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              if (typeof window !== "undefined") {
                window.close();
              }
            }}
            className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title="Close window"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Progress bar section */}
      <div className="backdrop-blur-xl bg-black/10 px-4 pt-3 pb-4">
        <div className="max-w-2xl mx-auto space-y-3">
          {/* Step dots */}
          <div className="flex items-center gap-1">
            {steps.map((s, i) => {
              const isDone = s.id < step;
              const isCurrent = s.id === step;
              return (
                <div key={s.id} className="flex items-center flex-1">
                  <div
                    className={`h-1.5 flex-1 rounded-full transition-all duration-700 ${
                      isDone
                        ? `bg-gradient-to-r ${s.gradient}`
                        : isCurrent
                          ? "bg-white"
                          : "bg-white/15"
                    }`}
                  />
                </div>
              );
            })}
          </div>

          {/* Labels — show prev, current, next */}
          <div className="flex justify-between items-center">
            <span className="text-white/40 text-[10px] font-semibold uppercase tracking-widest">
              {steps[step - 2]?.label || ""}
            </span>
            <span
              className={`text-white text-xs font-bold uppercase tracking-widest bg-gradient-to-r ${currentStepInfo?.gradient} bg-clip-text text-transparent`}
            >
              {currentStepInfo?.label}
            </span>
            <span className="text-white/40 text-[10px] font-semibold uppercase tracking-widest flex items-center gap-0.5">
              {steps[step]?.label || ""}
              {steps[step] && <ChevronRight size={10} />}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
