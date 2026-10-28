import {
  Briefcase,
  Calendar,
  Car,
  MessageSquare,
  BarChart2,
  Receipt,
  Clock,
  Users,
  Globe,
  CreditCard,
  FileText,
  Repeat,
  Settings,
  Truck,
  UserPlus,
  Inbox,
  LogOut,
  CalendarClock,
} from "lucide-react";

/**
 * Centralized route configuration
 * This is the single source of truth for button labels and page titles.
 * When you rename a button label here, the page title automatically updates.
 */
export const ROUTES = {
  // Bookings & Schedule
  ALL_TRIPS: {
    path: "/trips",
    label: "All Trips",
    icon: Briefcase,
    category: "bookings",
  },
  DISPATCH: {
    path: "/trips?new=true",
    label: "Dispatch - Book a Trip",
    icon: Calendar,
    category: "bookings",
  },
  CALENDAR: {
    path: "/calendar",
    label: "Calendar",
    icon: Calendar,
    category: "bookings",
  },
  ASSIGN_DRIVERS: {
    path: "/schedule-builder",
    label: "Assign Drivers",
    icon: UserPlus,
    category: "bookings",
  },
  SCHEDULE_DRIVES_2: {
    path: "/schedule-timeline",
    label: "Assign Drivers",
    icon: CalendarClock,
    category: "bookings",
  },
  PASSENGER_BOOKING_LINK: {
    path: "/book/catch-a-ride",
    label: "Online Booking Link",
    icon: Globe,
    category: "bookings",
    openInNewTab: true,
  },
  RECURRING_TRIPS: {
    path: "/recurring",
    label: "Recurring Trips",
    icon: Repeat,
    category: "bookings",
  },
  BLOCKED_TIMES: {
    path: "/blocked-times",
    label: "Blocked Times",
    icon: Clock,
    category: "bookings",
  },

  // Drivers
  DRIVERS: {
    path: "/drivers",
    label: "Manage Drivers",
    icon: Car,
    category: "drivers",
  },
  VEHICLES: {
    path: "/vehicles",
    label: "Manage Vehicles",
    icon: Truck,
    category: "drivers",
  },
  DRIVER_MESSAGES: {
    path: "/driver-messages",
    label: "Driver Messages",
    icon: MessageSquare,
    category: "drivers",
  },
  EARNINGS_REPORT: {
    path: "/earnings",
    label: "Driver Earnings Report",
    icon: BarChart2,
    category: "payroll",
  },

  // Passengers
  PASSENGERS: {
    path: "/passengers",
    label: "Passengers",
    icon: Users,
    category: "passengers",
  },
  MESSAGES: {
    path: "/messages",
    label: "Messages",
    icon: MessageSquare,
    category: "passengers",
  },

  // Financial
  PAYMENTS: {
    path: "/payments",
    label: "Payments",
    icon: CreditCard,
    category: "financial",
  },
  EXPENSES: {
    path: "/expenses",
    label: "Expenses",
    icon: Receipt,
    category: "financial",
  },

  // Other
  SERVICES: {
    path: "/services",
    label: "Services",
    icon: Briefcase,
    category: "other",
  },
  SETTINGS: {
    path: "/settings-2",
    label: "Settings",
    icon: Settings,
    category: "other",
  },
  MANAGE_AVAILABILITY: {
    path: "/dashboard/admin/manage-availability",
    label: "Manage Availability",
    icon: Clock,
    category: "other",
  },
  TRIPS_BY_DRIVER: {
    path: "/reports/by-driver",
    label: "Trips By Driver",
    icon: BarChart2,
    category: "other",
  },

  // Daily Routine
  TODAY_SCHEDULE: {
    path: "/schedule",
    label: "Today's Schedule",
    icon: Calendar,
    category: "daily",
  },
  PROCESS_PAYMENTS: {
    path: "/payments",
    label: "Process Payments",
    icon: CreditCard,
    category: "daily",
  },
  OVERNIGHT_ORDERS: {
    path: "/trips?status=needs_review",
    label: "Review Orders",
    icon: Inbox,
    category: "daily",
  },
  CHECK_MESSAGES: {
    path: "/messages?unread=true",
    label: "Check Messages",
    icon: MessageSquare,
    category: "daily",
  },
  FIVE_PM_REPORT: {
    path: "/five-pm-reminder",
    label: "5 PM Report",
    icon: Clock,
    category: "daily",
  },
  CLOSE_UP: {
    path: "#",
    label: "Close Up",
    icon: LogOut,
    category: "daily",
    isAction: true,
  },
};

/**
 * Get route configuration by path
 * This function matches the current path to a route configuration
 */
export function getRouteByPath(currentPath) {
  // Normalize path (remove query params and trailing slashes)
  const normalizedPath = currentPath.split("?")[0].replace(/\/$/, "");

  // Find exact match first
  const exactMatch = Object.values(ROUTES).find(
    (route) => route.path.split("?")[0].replace(/\/$/, "") === normalizedPath,
  );

  if (exactMatch) return exactMatch;

  // Try partial match for dynamic routes
  return Object.values(ROUTES).find((route) => {
    const routeBase = route.path.split("?")[0].replace(/\/$/, "");
    return normalizedPath.startsWith(routeBase);
  });
}

/**
 * Get page title for the current route
 * Use this in your page components to dynamically pull the title
 */
export function getPageTitle(currentPath) {
  const route = getRouteByPath(currentPath);
  return route?.label || "Dashboard";
}

/**
 * Group routes by category for QuickAccessBar
 */
export function getRoutesByCategory() {
  const categories = {
    bookings: [],
    drivers: [],
    passengers: [],
    financial: [],
    payroll: [],
    other: [],
    daily: [],
  };

  Object.values(ROUTES).forEach((route) => {
    if (categories[route.category]) {
      categories[route.category].push(route);
    }
  });

  return categories;
}
