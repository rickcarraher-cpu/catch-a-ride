import { Calendar, MessageSquare } from "lucide-react";

export function IntentSelection({ onBookTrip, onSendMessage }) {
  return (
    <div className="space-y-8">
      <div className="text-center space-y-3">
        <h2 className="text-3xl font-extrabold text-white">
          What Would You Like To Do?
        </h2>
        <p className="text-lg text-purple-200">
          Choose whether to book a trip or send us a quick message
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <button
          type="button"
          onClick={onBookTrip}
          className="flex flex-col items-center gap-4 py-12 px-8 rounded-3xl border-2 border-indigo-400 bg-indigo-500/20 hover:bg-indigo-500/30 hover:border-indigo-300 backdrop-blur transition-all group"
        >
          <Calendar
            size={48}
            className="text-indigo-300 group-hover:scale-110 transition-transform"
          />
          <span className="text-2xl font-bold text-white">Book A Trip</span>
          <span className="text-sm text-indigo-200 text-center">
            Schedule transportation with full trip details
          </span>
        </button>

        <button
          type="button"
          onClick={onSendMessage}
          className="flex flex-col items-center gap-4 py-12 px-8 rounded-3xl border-2 border-emerald-400 bg-emerald-500/20 hover:bg-emerald-500/30 hover:border-emerald-300 backdrop-blur transition-all group"
        >
          <MessageSquare
            size={48}
            className="text-emerald-300 group-hover:scale-110 transition-transform"
          />
          <span className="text-2xl font-bold text-white">Send A Message</span>
          <span className="text-sm text-emerald-200 text-center">
            Quick inquiry or question without booking
          </span>
        </button>
      </div>
    </div>
  );
}
