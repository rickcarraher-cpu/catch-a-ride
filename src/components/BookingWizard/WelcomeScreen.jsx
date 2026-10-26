import { HelpCircle } from "lucide-react";

export function WelcomeScreen({ settings, onStart }) {
  const handleShowGuide = () => {
    // Open the booking guide in a new tab
    window.open("/docs/booking-guide", "_blank");
    // Then proceed to intent selection
    onStart();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center px-4 py-12">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <div className="bg-gradient-to-br from-slate-800 to-purple-900 rounded-3xl shadow-2xl max-w-md w-full border border-purple-500/30">
          <div className="p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-500/20 border-2 border-purple-400 mb-6">
              <HelpCircle size={32} className="text-purple-300" />
            </div>

            <h2 className="text-2xl font-bold text-white mb-3">
              Do you need instructions?
            </h2>

            <p className="text-purple-200 mb-8">
              We have a quick guide that walks you through the entire booking
              process step-by-step.
            </p>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleShowGuide}
                className="w-full py-3 px-6 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold rounded-xl transition-all hover:scale-105 shadow-lg shadow-purple-500/50"
              >
                Yes, show me the guide
              </button>

              <button
                onClick={onStart}
                className="w-full py-3 px-6 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl transition-all border border-white/20"
              >
                No thanks, continue
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
