"use client";

import { useState } from "react";
import {
  User,
  ArrowLeftRight,
  Calendar,
  MapPin,
  Plane,
  Plus,
  CreditCard,
  ChevronDown,
  ChevronRight,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  Info,
  Clock,
  Phone,
  Mail,
  Bell,
  Send,
  Users,
} from "lucide-react";

export default function BookingGuide() {
  const [expandedStep, setExpandedStep] = useState(null);

  const toggleStep = (stepId) => {
    setExpandedStep(expandedStep === stepId ? null : stepId);
  };

  const steps = [
    {
      id: 1,
      title: "Step 1: Your Information",
      icon: User,
      color: "indigo",
      sections: [
        {
          title: "Enter your name",
          content: [
            "Enter your full name so we know who to pick up",
            "This will be saved for future bookings",
          ],
        },
        {
          title: "Contact information",
          content: [
            "Phone number: We'll use this to contact you about your trip",
            "Email (optional): For booking confirmations and receipts",
          ],
        },
      ],
    },
    {
      id: 2,
      title: "Step 2: Contact Preferences & Trip Type",
      icon: ArrowLeftRight,
      color: "pink",
      sections: [
        {
          title: "How should we contact you?",
          content: [
            "Email & SMS: Get confirmations via both email and text message",
            "Email Only: Receive confirmations only via email",
            "SMS Only: Receive confirmations only via text message",
            "None: No confirmations (not recommended)",
          ],
        },
        {
          title: "Choose your trip type",
          content: [
            "One-Way: Single trip from pickup to destination",
            "Round-Trip: Book both your outgoing and return trips at once",
          ],
        },
        {
          title: "Round-trip benefits",
          content: [
            "Book both trips together and save time",
            "Your pickup and dropoff locations are automatically reversed for the return trip",
            "Ensures your return ride is scheduled",
          ],
        },
      ],
    },
    {
      id: 3,
      title: "Step 3: When Do You Need a Ride?",
      icon: Calendar,
      color: "green",
      sections: [
        {
          title: "Select your pickup date and time",
          content: [
            "Choose the date from the calendar",
            "Enter the time you need to be picked up",
            "For airport trips, we recommend 2-3 hours before your flight",
          ],
        },
        {
          title: "Round-trip return (if applicable)",
          content: [
            "If you selected round-trip, also enter your return date and time",
            "Both trips will be booked together",
          ],
        },
      ],
    },
    {
      id: 4,
      title: "Step 4: Passengers & Baggage",
      icon: Users,
      color: "cyan",
      sections: [
        {
          title: "How many passengers?",
          content: [
            "Enter the total number of people traveling",
            "This helps us assign the right vehicle size",
          ],
        },
        {
          title: "Baggage details",
          content: [
            "Checked bags: Large suitcases that go in the trunk",
            "Carry-on bags: Smaller bags you'll keep with you",
            "Car seats: Let us know if you need child car seats",
            "Golf bags: Special equipment requiring extra space",
          ],
        },
      ],
    },
    {
      id: 5,
      title: "Step 5: Where Are You Going?",
      icon: MapPin,
      color: "orange",
      sections: [
        {
          title: "Pickup location",
          content: [
            "Enter your pickup address (street, city, state, ZIP)",
            "Or select from common locations like airports or hotels",
            "Be as specific as possible for accurate pickup",
          ],
        },
        {
          title: "Dropoff location",
          content: [
            "Enter your destination address",
            "Or select from common locations",
            "For round-trips, these locations will be reversed for your return",
          ],
        },
      ],
    },
    {
      id: 6,
      title: "Step 6: Trip Details",
      icon: Plane,
      color: "sky",
      sections: [
        {
          title: "Flight information (for airport trips)",
          content: [
            "Outgoing flight: Enter your flight number and airline",
            "Return flight: Enter your return flight details",
            "This helps us track your flight and adjust pickup time if needed",
          ],
        },
        {
          title: "Special requests",
          content: [
            "Add any special instructions for your driver",
            "Examples: 'Please call when you arrive', 'Need help with luggage'",
          ],
        },
      ],
    },
    {
      id: 7,
      title: "Step 7: Add-ons (Optional)",
      icon: Plus,
      color: "emerald",
      sections: [
        {
          title: "Additional services",
          content: [
            "Extra stops: Add stops along the way",
            "Car seats: Request child car seats",
            "Other services: Any additional services you need",
          ],
        },
        {
          title: "Round-trip add-ons",
          content: [
            "For round-trips, choose which leg each add-on applies to",
            "Options: Outgoing only, Return only, or Both trips",
          ],
        },
      ],
    },
    {
      id: 8,
      title: "Step 8: Review & Pay",
      icon: CreditCard,
      color: "emerald",
      sections: [
        {
          title: "Review your booking",
          content: [
            "Check all your trip details",
            "Verify pickup and dropoff locations",
            "Confirm date and time",
            "Review the total price",
          ],
        },
        {
          title: "Payment",
          content: [
            "You'll receive a payment link after booking",
            "Pay securely online via credit card",
            "Or choose to pay with cash, Venmo, or Zelle",
          ],
        },
        {
          title: "Confirmation",
          content: [
            "You'll receive a confirmation via your chosen method (email/SMS)",
            "Your driver will be notified",
            "You can make changes by contacting us",
          ],
        },
      ],
    },
  ];

  const tips = [
    {
      icon: Clock,
      title: "Book Early for Airport Trips",
      content:
        "For airport pickups, we recommend scheduling your ride 2-3 hours before your flight departure time to account for traffic and check-in.",
    },
    {
      icon: CheckCircle2,
      title: "Round-Trip Convenience",
      content:
        "Booking a round-trip saves time and ensures your return ride is scheduled. Your pickup and dropoff locations are automatically reversed.",
    },
    {
      icon: Info,
      title: "Flight Tracking",
      content:
        "When you provide your flight information, we can track your flight and adjust pickup times if there are delays.",
    },
    {
      icon: AlertCircle,
      title: "Special Requests",
      content:
        "Need extra help with luggage? Have specific pickup instructions? Add them in the special requests field so your driver is prepared.",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-12 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <BookOpen size={40} />
            <h1 className="text-4xl font-bold">Booking Guide</h1>
          </div>
          <p className="text-lg text-blue-100">
            Step-by-step instructions for booking your ride
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Quick Tips Section */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <Info size={24} className="text-blue-600" />
            Helpful Tips
          </h2>
          <div className="grid gap-4">
            {tips.map((tip, idx) => (
              <div
                key={idx}
                className="bg-white rounded-xl border-2 border-blue-200 p-6 shadow-sm"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <tip.icon size={20} className="text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 mb-2">
                      {tip.title}
                    </h3>
                    <p className="text-gray-700 text-sm leading-relaxed">
                      {tip.content}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Step-by-Step Guide */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <BookOpen size={24} className="text-blue-600" />
            Booking Steps
          </h2>

          <div className="space-y-4">
            {steps.map((step) => {
              const isExpanded = expandedStep === step.id;
              const Icon = step.icon;

              return (
                <div
                  key={step.id}
                  className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                >
                  {/* Step Header */}
                  <button
                    onClick={() => toggleStep(step.id)}
                    className="w-full p-6 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-12 h-12 rounded-full bg-${step.color}-100 flex items-center justify-center`}
                      >
                        <Icon size={24} className={`text-${step.color}-600`} />
                      </div>
                      <div className="text-left">
                        <h3 className="text-lg font-bold text-gray-900">
                          {step.title}
                        </h3>
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronDown size={24} className="text-gray-400" />
                    ) : (
                      <ChevronRight size={24} className="text-gray-400" />
                    )}
                  </button>

                  {/* Step Content */}
                  {isExpanded && (
                    <div className="px-6 pb-6 border-t border-gray-200">
                      <div className="pt-6 space-y-6">
                        {step.sections.map((section, idx) => (
                          <div key={idx}>
                            <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                              {section.title}
                            </h4>
                            <ul className="space-y-2 ml-4">
                              {section.content.map((item, itemIdx) => (
                                <li
                                  key={itemIdx}
                                  className="text-gray-700 text-sm leading-relaxed flex items-start gap-2"
                                >
                                  <span className="text-blue-500 mt-1">•</span>
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 p-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border-2 border-blue-200">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
              <Send size={20} className="text-blue-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 mb-2">Need Help?</h3>
              <p className="text-gray-700 text-sm leading-relaxed">
                If you have questions while booking, feel free to contact us.
                We're here to help make your ride as smooth as possible!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
