"use client";

import { useState } from "react";
import {
  User,
  ArrowLeftRight,
  Calendar,
  Users,
  Car,
  MapPin,
  Plane,
  Plus,
  DollarSign,
  CreditCard,
  Settings,
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
  FileText,
  Bus,
  Send,
} from "lucide-react";

export default function DispatchWizardGuide() {
  const [expandedStep, setExpandedStep] = useState(null);

  const toggleStep = (stepId) => {
    setExpandedStep(expandedStep === stepId ? null : stepId);
  };

  const steps = [
    {
      id: 1,
      title: "Step 1: Passenger Information",
      icon: User,
      color: "indigo",
      sections: [
        {
          title: "Have they traveled with us before?",
          content: [
            "Select 'Yes' to look up an existing passenger",
            "Select 'No' to create a new passenger profile",
          ],
        },
        {
          title: "Looking up existing passengers",
          content: [
            "Search by name, phone, or email",
            "If multiple matches are found, use the arrows to cycle through them",
            "The system will auto-fill their contact info and home address",
          ],
        },
        {
          title: "Creating a new passenger",
          content: [
            "Enter their full name (required)",
            "Add phone number and/or email (at least one is required)",
            "Optionally add their home address (street, city, state, ZIP)",
            "This information will be saved for future bookings",
          ],
        },
        {
          title: "Clone from previous trip",
          content: [
            "Click 'Clone from Previous Trip' to copy details from an existing booking",
            "Search by passenger name or booking number",
            "Select the trip you want to clone",
            "All trip details (locations, services, add-ons) will be pre-filled",
          ],
        },
      ],
    },
    {
      id: 2,
      title: "Step 2: Contact & Trip Type",
      icon: ArrowLeftRight,
      color: "pink",
      sections: [
        {
          title: "Contact preferences",
          content: [
            "Email: Optional, used for confirmations and receipts",
            "Notification preference: Choose how the passenger receives confirmations",
            "Options: Email & SMS, Email Only, SMS Only, or None",
          ],
        },
        {
          title: "Trip type selection",
          content: [
            "One-Way: Single trip from pickup to dropoff",
            "Round-Trip: Automatically creates a return trip with reversed locations",
            "Tour: Multi-stop trip with custom itinerary (Luxury Van only)",
            "Time-Based: Hourly rate ($55/hr, rounded to nearest 15 min)",
          ],
        },
        {
          title: "Time-based trips",
          content: [
            "Enter trip duration in hours (e.g., 1.5 for 90 minutes)",
            "Price is automatically calculated: rounded hours × $55",
            "Automatically saved as a Quote (no confirmations sent)",
            "Ideal for hourly charters or flexible-duration trips",
          ],
        },
      ],
    },
    {
      id: 3,
      title: "Step 3: Date & Time",
      icon: Calendar,
      color: "green",
      sections: [
        {
          title: "Outgoing trip",
          content: [
            "Select the pickup date using the calendar",
            "Enter the pickup time (24-hour or 12-hour format accepted)",
            "The system will validate the date/time is in the future",
          ],
        },
        {
          title: "Round-trip return",
          content: [
            "If round-trip was selected, also enter return date and time",
            "Return trip will be created automatically with reversed locations",
            "Both trips will be linked in the system",
          ],
        },
        {
          title: "Tour end time",
          content: [
            "For tours, enter the expected end time",
            "This helps with driver scheduling and pricing",
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
          title: "Passenger count",
          content: [
            "Enter the number of passengers (required, minimum 1)",
            "This helps determine the appropriate vehicle size",
          ],
        },
        {
          title: "Baggage information",
          content: [
            "Checked bags: Large suitcases going in the trunk",
            "Carry-on bags: Smaller bags passengers keep with them",
            "Car seats: Number of child car seats needed",
            "Golf bags: Special equipment requiring extra space",
          ],
        },
      ],
    },
    {
      id: 5,
      title: "Step 5: Vehicle Type",
      icon: Car,
      color: "teal",
      sections: [
        {
          title: "Vehicle category selection (Required)",
          content: [
            "Choose the vehicle type for this trip",
            "Options: Sedan, SUV, Luxury Van, or other configured categories",
            "This determines which drivers and vehicles can be assigned",
            "Tours are automatically locked to Luxury Van",
          ],
        },
        {
          title: "Important note",
          content: [
            "You must select a vehicle type before proceeding",
            "The 'Next' button will be disabled until a selection is made",
          ],
        },
      ],
    },
    {
      id: 6,
      title: "Step 6: Pickup & Dropoff Locations",
      icon: MapPin,
      color: "orange",
      sections: [
        {
          title: "Pickup location",
          content: [
            "Use Home: Auto-fills the passenger's saved home address",
            "Preferred Location: Select from pre-configured locations (airports, hotels, etc.)",
            "Other: Enter a custom address with street, city, state, and ZIP",
          ],
        },
        {
          title: "Dropoff location",
          content: [
            "Same options as pickup: Home, Preferred, or Other",
            "For round-trips, these will be automatically reversed for the return trip",
          ],
        },
        {
          title: "Service auto-detection",
          content: [
            "The system automatically detects the service type based on addresses",
            "Examples: BNA (airport), Downtown, The Farm, or Custom",
            "This happens automatically when you proceed to the next step",
          ],
        },
      ],
    },
    {
      id: 7,
      title: "Step 7: Trip Details",
      icon: Plane,
      color: "sky",
      sections: [
        {
          title: "Flight information (for airport trips)",
          content: [
            "Outgoing flight: Flight number and airline for departures",
            "Returning flight: Flight number and airline for arrivals",
            "International flights: Check the box and specify customs location",
          ],
        },
        {
          title: "Special requests & notes",
          content: [
            "Special requests: Passenger-facing notes (e.g., 'Please call when you arrive')",
            "Internal notes: Private notes for office use only",
            "These are separate fields to keep passenger and internal info organized",
          ],
        },
        {
          title: "Requested driver",
          content: [
            "Optionally enter a driver name the passenger requested",
            "This is a preference, not a guarantee",
            "The actual driver assignment happens in Step 11",
          ],
        },
      ],
    },
    {
      id: 8,
      title: "Step 8: Add-ons",
      icon: Plus,
      color: "emerald",
      sections: [
        {
          title: "Available add-ons",
          content: [
            "Select any additional services (stops, car seats, etc.)",
            "Enter quantity for each add-on",
            "Customize pricing if needed (defaults to service price)",
          ],
        },
        {
          title: "Round-trip add-ons",
          content: [
            "For round-trips, choose which leg each add-on applies to:",
            "Outgoing only, Incoming only, or Both legs",
            "Separate pricing can be set for each leg",
          ],
        },
        {
          title: "Stop descriptions",
          content: [
            "For stop add-ons, you can add a description of each stop",
            "This helps the driver know where to go",
          ],
        },
      ],
    },
    {
      id: 9,
      title: "Step 9: Pricing",
      icon: DollarSign,
      color: "amber",
      sections: [
        {
          title: "Distance calculation",
          content: [
            "The system automatically calculates distance using Google Maps",
            "Manual entry: If auto-calculation fails, enter miles manually",
            "Recalculate: Click the refresh button to recalculate distance",
          ],
        },
        {
          title: "Price calculation",
          content: [
            "Base price: Calculated from distance × rate per mile (if configured)",
            "Minimum price: $50 (if rate per mile is set)",
            "Add-ons: Each add-on price is added to the total",
            "Credit card fee: 3.5% added if payment method is Square Invoice (credit card)",
          ],
        },
        {
          title: "Manual price override",
          content: [
            "Click 'Edit' next to the price to manually adjust",
            "Useful for custom pricing or special discounts",
            "The system will remember your custom price",
          ],
        },
        {
          title: "Payment method",
          content: [
            "Square Invoice: Online payment link (adds 3.5% CC fee)",
            "Venmo: Mobile payment",
            "Zelle: Bank transfer",
            "Cash: Payment in cash to driver",
            "Comp: Complimentary trip (no charge)",
          ],
        },
      ],
    },
    {
      id: 10,
      title: "Step 10: Review",
      icon: CreditCard,
      color: "emerald",
      sections: [
        {
          title: "Review all details",
          content: [
            "Passenger information and contact details",
            "Trip date, time, and locations",
            "Selected services and add-ons",
            "Total price breakdown",
            "Payment method",
          ],
        },
        {
          title: "Make changes",
          content: [
            "Use the 'Previous' button to go back and edit any step",
            "All your entered information will be preserved",
          ],
        },
      ],
    },
    {
      id: 11,
      title: "Step 11: Admin Options & Submit",
      icon: Settings,
      color: "violet",
      sections: [
        {
          title: "Driver assignment",
          content: [
            "Auto-assign: Leave blank to use rotation system",
            "Manual assign: Select a specific driver from the dropdown",
            "Only active drivers are shown",
          ],
        },
        {
          title: "Vehicle assignment",
          content: [
            "Optional: Assign a specific vehicle",
            "If a driver is selected, only their assigned vehicles are shown",
            "Leave blank if no specific vehicle is needed",
          ],
        },
        {
          title: "Referral source",
          content: [
            "Track how the passenger heard about your service",
            "Examples: Google, Facebook, Friend, etc.",
            "This helps with marketing analytics",
          ],
        },
        {
          title: "Booked by",
          content: [
            "Enter your name (the dispatcher creating this booking)",
            "This tracks who created the trip for internal records",
          ],
        },
        {
          title: "Driver notes (Internal)",
          content: [
            "Private notes only visible to drivers and admins",
            "Passengers will NOT see these notes",
            "Use for special instructions or internal reminders",
          ],
        },
        {
          title: "Submit options",
          content: [
            "Approve & Send Confirmations: Creates trip and sends notifications to driver and passenger",
            "Save Without Sending: Creates trip but does NOT send any notifications",
            "Quote mode: For time-based trips, automatically saves as quote without confirmations",
          ],
        },
      ],
    },
  ];

  const tips = [
    {
      icon: CheckCircle2,
      title: "Quick Tip: Clone Previous Trips",
      content:
        "Save time by cloning a passenger's previous trip. All details (locations, services, add-ons) are copied, and you just need to update the date/time.",
    },
    {
      icon: AlertCircle,
      title: "Important: Vehicle Type Required",
      content:
        "You must select a vehicle type in Step 5 before proceeding. This ensures the trip can be properly assigned to the right driver and vehicle.",
    },
    {
      icon: Info,
      title: "Round-Trip Automation",
      content:
        "When you select round-trip, the system automatically creates two separate trips with reversed pickup/dropoff locations. Both trips are linked together.",
    },
    {
      icon: Clock,
      title: "Time-Based Trips",
      content:
        "For hourly charters, use the time-based option. Price is calculated as rounded hours × $55, and the trip is automatically saved as a quote.",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-12 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <BookOpen size={40} />
            <h1 className="text-4xl font-bold">Dispatch Wizard Guide</h1>
          </div>
          <p className="text-lg text-indigo-100">
            Complete step-by-step instructions for creating trips using the
            dispatch booking wizard
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Quick Tips Section */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <Info size={24} className="text-blue-600" />
            Quick Tips
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
            <FileText size={24} className="text-indigo-600" />
            Step-by-Step Instructions
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
                              <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                              {section.title}
                            </h4>
                            <ul className="space-y-2 ml-4">
                              {section.content.map((item, itemIdx) => (
                                <li
                                  key={itemIdx}
                                  className="text-gray-700 text-sm leading-relaxed flex items-start gap-2"
                                >
                                  <span className="text-indigo-500 mt-1">
                                    •
                                  </span>
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
        <div className="mt-12 p-6 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border-2 border-indigo-200">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
              <Send size={20} className="text-indigo-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 mb-2">Need More Help?</h3>
              <p className="text-gray-700 text-sm leading-relaxed">
                If you have questions about using the dispatch wizard, contact
                your system administrator or refer to the platform
                documentation.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
