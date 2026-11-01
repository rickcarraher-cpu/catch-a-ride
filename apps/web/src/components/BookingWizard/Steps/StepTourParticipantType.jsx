import { Users, UserCheck } from "lucide-react";

export function StepTourParticipantType({ formData, set }) {
  // Auto-set to null on mount since we're using a different model
  // (1 primary passenger + up to 7 guests)
  if (formData.tour_participant_type !== null) {
    set({ tour_participant_type: null });
  }

  return (
    <>
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Tour Participants</h2>
        <p className="text-sm text-gray-500 mt-1">How tour participants work</p>
      </div>

      {/* Info card explaining the structure */}
      <div className="bg-purple-50 border-2 border-purple-200 rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-purple-500 flex items-center justify-center shrink-0">
            <Users size={24} className="text-white" />
          </div>
          <div className="flex-1">
            <p className="text-lg font-bold text-purple-900 mb-3">
              Primary Passenger + Guests
            </p>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-white text-xs font-bold">1</span>
                </div>
                <div>
                  <p className="font-semibold text-purple-900">
                    Primary Passenger
                  </p>
                  <p className="text-sm text-purple-800 mt-1">
                    The main contact who will receive all booking confirmations,
                    updates, and communications via email and SMS.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-purple-400 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-white text-xs font-bold">+7</span>
                </div>
                <div>
                  <p className="font-semibold text-purple-900">
                    Additional Guests (Optional)
                  </p>
                  <p className="text-sm text-purple-800 mt-1">
                    Up to 7 additional guests can join the tour. Guest names and
                    pickup/drop-off locations are recorded, but they won't
                    receive booking confirmations.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Visual example */}
      <div className="bg-white border-2 border-gray-200 rounded-2xl p-6">
        <p className="text-sm font-semibold text-gray-700 mb-4">
          Example Tour Group:
        </p>
        <div className="space-y-2">
          <div className="flex items-center gap-3 p-3 bg-purple-100 border border-purple-300 rounded-xl">
            <UserCheck size={20} className="text-purple-700" />
            <div>
              <p className="font-semibold text-purple-900">
                John Smith (Primary)
              </p>
              <p className="text-xs text-purple-700">
                ✉️ Receives all confirmations
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl">
            <Users size={20} className="text-gray-500" />
            <div>
              <p className="font-semibold text-gray-700">Jane Doe (Guest)</p>
              <p className="text-xs text-gray-500">No confirmations sent</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl">
            <Users size={20} className="text-gray-500" />
            <div>
              <p className="font-semibold text-gray-700">Bob Johnson (Guest)</p>
              <p className="text-xs text-gray-500">No confirmations sent</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
