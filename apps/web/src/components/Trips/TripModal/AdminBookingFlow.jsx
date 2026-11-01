import {
  UserCheck,
  UserPlus,
  Clipboard,
  Copy,
  Calendar,
  MessageSquare,
} from "lucide-react";

function IntentSelection({ onBookTrip, onSendMessage }) {
  return (
    <div className="p-8 space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-bold text-gray-900">
          What Would You Like To Do?
        </h2>
        <p className="text-sm text-gray-500">
          Choose whether to book a trip or send a quick message
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <button
          type="button"
          onClick={onBookTrip}
          className="flex flex-col items-center gap-3 py-8 px-6 rounded-xl border-2 border-indigo-200 bg-indigo-50 hover:border-indigo-400 hover:bg-indigo-100 transition-all group"
        >
          <Calendar
            size={32}
            className="text-indigo-600 group-hover:scale-110 transition-transform"
          />
          <span className="text-base font-bold text-indigo-900">
            Book A Trip
          </span>
          <span className="text-xs text-indigo-600 text-center">
            Schedule transportation with full details
          </span>
        </button>

        <button
          type="button"
          onClick={onSendMessage}
          className="flex flex-col items-center gap-3 py-8 px-6 rounded-xl border-2 border-green-200 bg-green-50 hover:border-green-400 hover:bg-green-100 transition-all group"
        >
          <MessageSquare
            size={32}
            className="text-green-600 group-hover:scale-110 transition-transform"
          />
          <span className="text-base font-bold text-green-900">
            Send A Message
          </span>
          <span className="text-xs text-green-600 text-center">
            Quick inquiry or question
          </span>
        </button>
      </div>
    </div>
  );
}

function AdminBookingFlow({
  onNewPassenger,
  onReturningPassenger,
  onCloneTrip,
}) {
  return (
    <div className="p-8 space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-bold text-gray-900">
          How Would You Like To Book This Trip?
        </h2>
        <p className="text-sm text-gray-500">
          Choose the best option for this booking.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <button
          type="button"
          onClick={onReturningPassenger}
          className="flex flex-col items-center gap-3 py-6 px-4 rounded-xl border-2 border-indigo-200 bg-indigo-50 hover:border-indigo-400 hover:bg-indigo-100 transition-all group"
        >
          <UserCheck
            size={28}
            className="text-indigo-600 group-hover:scale-110 transition-transform"
          />
          <span className="text-sm font-bold text-indigo-900">
            Returning Passenger
          </span>
          <span className="text-xs text-indigo-600 text-center">
            Look up existing passenger
          </span>
        </button>

        <button
          type="button"
          onClick={onCloneTrip}
          className="flex flex-col items-center gap-3 py-6 px-4 rounded-xl border-2 border-purple-200 bg-purple-50 hover:border-purple-400 hover:bg-purple-100 transition-all group"
        >
          <Copy
            size={28}
            className="text-purple-600 group-hover:scale-110 transition-transform"
          />
          <span className="text-sm font-bold text-purple-900">Clone Trip</span>
          <span className="text-xs text-purple-600 text-center">
            Copy from past booking
          </span>
        </button>

        <button
          type="button"
          onClick={onNewPassenger}
          className="flex flex-col items-center gap-3 py-6 px-4 rounded-xl border-2 border-gray-200 bg-gray-50 hover:border-gray-400 hover:bg-gray-100 transition-all group"
        >
          <UserPlus
            size={28}
            className="text-gray-600 group-hover:scale-110 transition-transform"
          />
          <span className="text-sm font-bold text-gray-900">New Passenger</span>
          <span className="text-xs text-gray-500 text-center">
            Start completely fresh
          </span>
        </button>
      </div>
    </div>
  );
}

function BookingTypeChoice({ onNewBooking, onCloneTrip, onBack }) {
  return (
    <div className="p-8 space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-bold text-gray-900">
          Is This a New Booking or a Clone?
        </h2>
        <p className="text-sm text-gray-500">
          Choose whether to start fresh or copy a previous trip.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <button
          type="button"
          onClick={onNewBooking}
          className="flex flex-col items-center gap-3 py-8 px-6 rounded-xl border-2 border-blue-200 bg-blue-50 hover:border-blue-400 hover:bg-blue-100 transition-all group"
        >
          <Clipboard
            size={32}
            className="text-blue-600 group-hover:scale-110 transition-transform"
          />
          <span className="text-base font-bold text-blue-900">New Booking</span>
          <span className="text-xs text-blue-600 text-center">
            Look up passenger info only
          </span>
        </button>

        <button
          type="button"
          onClick={onCloneTrip}
          className="flex flex-col items-center gap-3 py-8 px-6 rounded-xl border-2 border-purple-200 bg-purple-50 hover:border-purple-400 hover:bg-purple-100 transition-all group"
        >
          <Copy
            size={32}
            className="text-purple-600 group-hover:scale-110 transition-transform"
          />
          <span className="text-base font-bold text-purple-900">
            Clone Trip
          </span>
          <span className="text-xs text-purple-600 text-center">
            Copy all details from past booking
          </span>
        </button>
      </div>

      <button
        type="button"
        onClick={onBack}
        className="w-full text-center text-sm text-gray-400 hover:text-gray-600 font-medium"
      >
        ← Back
      </button>
    </div>
  );
}

export { IntentSelection, AdminBookingFlow, BookingTypeChoice };
