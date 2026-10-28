import {
  User,
  Mail,
  Calendar,
  MapPin,
  Plane,
  CreditCard,
  Plus,
  ArrowLeftRight,
  Settings,
  Users,
  Repeat,
  Car,
  DollarSign,
  Bus,
  FileText,
} from "lucide-react";

export const STEPS = [
  {
    id: 1,
    label: "You",
    icon: User,
    gradient: "from-indigo-500 to-purple-500",
    accent: "indigo",
  },
  // Step 2: Contact info + Trip Type Selection (one-way or round-trip)
  {
    id: 2,
    label: "Contact & Trip",
    icon: ArrowLeftRight,
    gradient: "from-pink-500 to-rose-500",
    accent: "pink",
  },
  {
    id: 3,
    label: "When",
    icon: Calendar,
    gradient: "from-green-500 to-emerald-500",
    accent: "green",
  },
  // Step 4: Passengers & Baggage
  {
    id: 4,
    label: "Passengers",
    icon: Users,
    gradient: "from-cyan-500 to-blue-500",
    accent: "cyan",
  },
  // Step 5: Vehicle Type
  {
    id: 5,
    label: "Vehicle",
    icon: Car,
    gradient: "from-teal-500 to-cyan-500",
    accent: "teal",
  },
  {
    id: 6,
    label: "Where",
    icon: MapPin,
    gradient: "from-orange-500 to-red-500",
    accent: "orange",
  },
  {
    id: 7,
    label: "Details",
    icon: Plane,
    gradient: "from-sky-500 to-blue-500",
    accent: "sky",
  },
  {
    id: 8,
    label: "Review & Pay",
    icon: CreditCard,
    gradient: "from-emerald-500 to-green-500",
    accent: "emerald",
  },
];

// Passenger-facing online booking page uses a simpler 8-step flow
// (skips Passengers & Vehicle steps — those are handled inline)
export const PASSENGER_BOOKING_STEPS = [
  {
    id: 1,
    label: "You",
    icon: User,
    gradient: "from-indigo-500 to-purple-500",
    accent: "indigo",
  },
  {
    id: 2,
    label: "Contact & Trip",
    icon: ArrowLeftRight,
    gradient: "from-pink-500 to-rose-500",
    accent: "pink",
  },
  {
    id: 3,
    label: "When",
    icon: Calendar,
    gradient: "from-green-500 to-emerald-500",
    accent: "green",
  },
  // NEW: Passengers & Baggage step
  {
    id: 4,
    label: "Passengers",
    icon: Users,
    gradient: "from-cyan-500 to-blue-500",
    accent: "cyan",
  },
  {
    id: 5,
    label: "Where",
    icon: MapPin,
    gradient: "from-orange-500 to-red-500",
    accent: "orange",
  },
  {
    id: 6,
    label: "Details",
    icon: Plane,
    gradient: "from-sky-500 to-blue-500",
    accent: "sky",
  },
  {
    id: 7,
    label: "Add-ons",
    icon: Plus,
    gradient: "from-emerald-500 to-teal-500",
    accent: "emerald",
  },
  {
    id: 8,
    label: "Review & Pay",
    icon: CreditCard,
    gradient: "from-emerald-500 to-green-500",
    accent: "emerald",
  },
];

// Dispatch mode adds Add-ons, Pricing, Review, and Admin Options steps
export const DISPATCH_STEPS = [
  ...STEPS.slice(0, 7), // Steps 1-7 (You, Contact, When, Passengers, Vehicle, Where, Details)
  {
    id: 8,
    label: "Add-ons",
    icon: Plus,
    gradient: "from-emerald-500 to-teal-500",
    accent: "emerald",
  },
  {
    id: 9,
    label: "Pricing",
    icon: DollarSign,
    gradient: "from-amber-500 to-orange-500",
    accent: "amber",
  },
  {
    id: 10,
    label: "Review",
    icon: CreditCard,
    gradient: "from-emerald-500 to-green-500",
    accent: "emerald",
  },
  {
    id: 11,
    label: "Admin",
    icon: Settings,
    gradient: "from-violet-500 to-purple-500",
    accent: "violet",
  },
];

// NEW: Recurring mode steps (dispatch steps + recurring configuration)
export const RECURRING_STEPS = [
  ...DISPATCH_STEPS.slice(0, 11), // Steps 1-11 (all dispatch steps)
  {
    id: 12,
    label: "Recurring",
    icon: Repeat,
    gradient: "from-blue-500 to-cyan-500",
    accent: "blue",
  },
  {
    id: 13,
    label: "Review",
    icon: CreditCard,
    gradient: "from-emerald-500 to-green-500",
    accent: "emerald",
  },
];

// Tour-specific dispatch steps — replaces steps 4-8 of DISPATCH_STEPS for tour bookings
export const TOUR_DISPATCH_STEPS = [
  {
    id: 1,
    label: "Passenger",
    icon: User,
    gradient: "from-indigo-500 to-purple-500",
    accent: "indigo",
  },
  {
    id: 2,
    label: "Trip Type",
    icon: ArrowLeftRight,
    gradient: "from-pink-500 to-rose-500",
    accent: "pink",
  },
  {
    id: 3,
    label: "When",
    icon: Calendar,
    gradient: "from-green-500 to-emerald-500",
    accent: "green",
  },
  {
    id: 4,
    label: "Who's Coming",
    icon: Users,
    gradient: "from-purple-500 to-violet-500",
    accent: "purple",
  },
  {
    id: 5,
    label: "Participants",
    icon: Users,
    gradient: "from-violet-500 to-purple-500",
    accent: "violet",
  },
  {
    id: 6,
    label: "Itinerary",
    icon: FileText,
    gradient: "from-fuchsia-500 to-pink-500",
    accent: "fuchsia",
  },
  {
    id: 7,
    label: "Tour Pricing",
    icon: DollarSign,
    gradient: "from-emerald-500 to-teal-500",
    accent: "emerald",
  },
  {
    id: 8,
    label: "Location",
    icon: MapPin,
    gradient: "from-orange-500 to-red-500",
    accent: "orange",
  },
  {
    id: 9,
    label: "Details",
    icon: Plane,
    gradient: "from-sky-500 to-blue-500",
    accent: "sky",
  },
  {
    id: 10,
    label: "Review",
    icon: CreditCard,
    gradient: "from-emerald-500 to-green-500",
    accent: "emerald",
  },
  {
    id: 11,
    label: "Admin",
    icon: Settings,
    gradient: "from-violet-500 to-purple-500",
    accent: "violet",
  },
];

export const INITIAL_FORM = {
  name: "",
  phone: "",
  email: "",
  notification_preference: "both",
  street_address: "",
  city: "",
  state: "",
  zip_code: "",
  passenger_notes: "",
  // NEW: Trip type selection
  trip_type: "one-way", // "one-way", "round-trip", or "tour"
  date: "",
  time: "",
  // Return trip fields for round-trip
  return_date: "",
  return_time: "",
  service_id: "",
  service_price: "",
  // NEW: Vehicle category preference
  vehicle_category: null,
  pickup: "",
  pickup_street: "",
  pickup_city: "",
  pickup_state: "",
  pickup_zip: "",
  pickup_is_preset: false,
  pickup_preferred_label: "",
  pickup_location_type: "", // "home", "preferred", or "other"
  dropoff: "",
  dropoff_street: "",
  dropoff_city: "",
  dropoff_state: "",
  dropoff_zip: "",
  dropoff_is_preset: false,
  dropoff_preferred_label: "",
  dropoff_location_type: "", // "home", "preferred", or "other"
  // Passenger's home address — stored separately so it persists even when
  // pickup/dropoff fields are reset
  home_street: "",
  home_city: "",
  home_state: "",
  home_zip: "",
  destination: "",
  notes: "",
  special_requests: "",
  num_people: "",
  num_bags_checked: "",
  num_bags_carry_on: "",
  num_car_seats: "", // NEW: car seats field
  num_golf_bags: "", // NEW: golf bags field
  special_items: "", // Special items free text (golf bags, strollers, car seats, etc.)
  outgoing_flight_info: "",
  returning_flight_info: "",
  is_international_flight: false,
  customs_clearance_location: "",
  payment_method: "",
  requested_driver_name: "",
  referral_source: "", // NEW: How they heard about us
  is_recurring: false,
  recurring_frequency: "",
  is_round_trip: false,
  selected_addons: {},
  addon_prices: {},
  stop_descriptions: {},
  save_address_as_home: false,

  // TOUR-SPECIFIC FIELDS
  is_tour: false,
  tour_end_time: "",
  tour_participant_type: null, // No longer used - tours have 1 primary passenger + up to 7 guests
  tour_flat_fee: "",
  tour_payment_split: "single", // "single" or "divided"
  tour_participants: [], // Array of additional guests: {name, pickup_location, dropoff_location}
  tour_itinerary: [], // Array of {sequence_order, location, description}
  tour_notes: "", // Free-form itinerary notes

  // DISPATCH-ONLY FIELDS
  employee_id: "", // Assigned driver
  vehicle_id: "", // Assigned vehicle
  is_tentative: false, // Mark as tentative booking
  tentative_reason: "", // Reason for tentative status
  booker_name: "", // Who booked this trip (admin name)
  driver_notes: "", // Notes for the driver
  booked_by: "Admin", // Source of booking
  client_id: null, // Passenger ID (populated from lookup)
  status: "pending", // Trip status
  wedding_id: null, // Optional: link this trip to a wedding package

  // TIME-BASED TRIP FIELDS
  is_time_based: false, // If true, price = rounded_hours × $55 and status = quote
  trip_duration_hours: "", // Duration entered by dispatcher (decimal hours, e.g. 1.5)

  // RECURRING-ONLY FIELDS
  frequency: "weekly", // daily, weekly, bi-weekly, monthly
  num_occurrences: "", // Number of trips to generate (0 or empty = unlimited)
  day_of_week: "", // Day of week (0-6, 0=Sunday) for weekly/bi-weekly
  template_appointment_id: null, // Original trip this was cloned from

  // RECEIPT
  needs_receipt: null, // null = not answered (treated as no), true = yes, false = no
};
