"use client";

import { useEffect, useState, useMemo } from "react";
import useUser from "@/utils/useUser";
import useAuth from "@/utils/useAuth";
import TripDetailsModal from "@/components/DriverPortal/TripDetailsModal";
import {
  ChevronLeft,
  MapPin,
  Clock,
  User,
  Briefcase,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  X,
  CalendarPlus,
} from "lucide-react";

export default function DriverSchedulePage() {
  const { data: user, loading: userLoading } = useUser();
  const { signInWithCredentials } = useAuth();
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [trips, setTrips] = useState([]);
  const [tripsLoading, setTripsLoading] = useState(false);
  const [viewRange, setViewRange] = useState("upcoming"); // 'upcoming' | 'today' | 'week' | 'all'
  const [showPast, setShowPast] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState(null);

  // Driver login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // No bypass — login always required

  useEffect(() => {
    const fetchEmployee = async () => {
      try {
        const res = await fetch("/api/driver/employee");
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to fetch driver information");
        }
        const data = await res.json();
        setEmployee(data.employee);
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchEmployee();
    } else if (!userLoading && !user) {
      setLoading(false);
    }
  }, [user, userLoading]);

  // Fetch trips when employee is loaded
  useEffect(() => {
    if (!employee) return;
    const fetchTrips = async () => {
      setTripsLoading(true);
      try {
        const res = await fetch(`/api/appointments?employee_id=${employee.id}`);
        if (!res.ok) throw new Error("Failed to fetch schedule");
        const data = await res.json();

        console.log("[Driver Schedule] Raw API response count:", data.length);
        console.log("[Driver Schedule] Employee ID:", employee.id);
        console.log(
          "[Driver Schedule] First 5 trips:",
          data.slice(0, 5).map((t) => ({
            id: t.id,
            booking_number: t.booking_number,
            status: t.status,
            driver_accepted: t.driver_accepted,
            start_time: t.start_time,
            employee_id: t.employee_id,
          })),
        );

        // Check if booking 26-2258 is in the response
        const pendingTrip = data.find((t) => t.booking_number === "26-2258");
        if (pendingTrip) {
          console.log("[Driver Schedule] Found pending trip 26-2258:", {
            id: pendingTrip.id,
            status: pendingTrip.status,
            driver_accepted: pendingTrip.driver_accepted,
            employee_id: pendingTrip.employee_id,
            start_time: pendingTrip.start_time,
          });
        } else {
          console.log(
            "[Driver Schedule] Pending trip 26-2258 NOT in API response",
          );
        }

        setTrips(data);
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setTripsLoading(false);
      }
    };
    fetchTrips();
  }, [employee]);

  const handleDriverLogin = async (e) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);

    try {
      const res = await fetch("/api/auth/verify-driver-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Invalid email or password");
      }

      await signInWithCredentials({
        email: loginEmail,
        password: loginPassword,
        callbackUrl: "/driver/schedule",
        redirect: true,
      });
    } catch (err) {
      console.error(err);
      setLoginError(err.message || "Invalid email or password");
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    window.location.href = "/account/logout";
  };

  // Filter and group trips
  const { upcomingTrips, todayTrips, pastTrips, groupedByDate } =
    useMemo(() => {
      const now = new Date();
      const todayStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );
      const todayEnd = new Date(todayStart);
      todayEnd.setDate(todayEnd.getDate() + 1);

      const upcoming = [];
      const today = [];
      const past = [];

      const sorted = [...trips].sort(
        (a, b) => new Date(a.start_time) - new Date(b.start_time),
      );

      sorted.forEach((trip) => {
        if (
          trip.status === "cancelled" ||
          trip.status === "canceled" ||
          trip.status === "deleted" ||
          trip.is_tentative
        )
          return;
        const tripDate = new Date(trip.start_time);
        if (tripDate < todayStart) {
          past.push(trip);
        } else if (tripDate >= todayStart && tripDate < todayEnd) {
          today.push(trip);
        } else {
          upcoming.push(trip);
        }
      });

      // Group upcoming + today by date
      const grouped = {};
      [...today, ...upcoming].forEach((trip) => {
        const dateKey = new Date(trip.start_time).toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        });
        if (!grouped[dateKey]) grouped[dateKey] = [];
        grouped[dateKey].push(trip);
      });

      return {
        upcomingTrips: upcoming,
        todayTrips: today,
        pastTrips: past.reverse(),
        groupedByDate: grouped,
      };
    }, [trips]);

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      timeZone: "America/Chicago",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString("en-US", {
      timeZone: "America/Chicago",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const handleDriverResponse = async (tripId, decision) => {
    try {
      const res = await fetch(`/api/driver/trips/${tripId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to respond");
      }

      // Refresh trips after successful response
      const refreshRes = await fetch(
        `/api/appointments?employee_id=${employee.id}`,
      );
      if (refreshRes.ok) {
        const data = await refreshRes.json();
        setTrips(data);
      }

      alert(
        decision === "accepted"
          ? "Trip accepted successfully!"
          : "Trip declined successfully.",
      );
    } catch (error) {
      console.error("Error responding to trip:", error);
      alert(error.message || "Failed to respond to trip");
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "confirmed":
        return "bg-green-100 text-green-800 border-green-200";
      case "completed":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const isToday = (dateString) => {
    const now = new Date();
    const date = new Date(dateString);
    return (
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()
    );
  };

  const isTomorrow = (dateString) => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const date = new Date(dateString);
    return (
      date.getDate() === tomorrow.getDate() &&
      date.getMonth() === tomorrow.getMonth() &&
      date.getFullYear() === tomorrow.getFullYear()
    );
  };

  const getDateLabel = (dateStr) => {
    // dateStr is already a formatted string like "Monday, August 3, 2026"
    // Check against today/tomorrow using the first trip in that group
    const groupTrips = groupedByDate[dateStr];
    if (groupTrips && groupTrips.length > 0) {
      if (isToday(groupTrips[0].start_time)) return "Today";
      if (isTomorrow(groupTrips[0].start_time)) return "Tomorrow";
    }
    return dateStr;
  };

  // Show driver login form if not authenticated
  if (!userLoading && !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900">
        <form
          onSubmit={handleDriverLogin}
          className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl"
        >
          <div className="mb-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
              <svg
                className="h-8 w-8 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Driver Portal</h1>
            <p className="mt-2 text-sm text-gray-600">
              Sign in with your driver email
            </p>
          </div>
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            {loginError && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                {loginError}
              </div>
            )}
            <button
              type="submit"
              disabled={loginLoading}
              className="w-full rounded-lg bg-blue-600 px-4 py-3 text-base font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loginLoading ? "Signing in..." : "Sign In"}
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (userLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block h-8 w-8 rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (error && !employee) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg">
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-700">
            <h2 className="text-lg font-semibold mb-2">Access Error</h2>
            <p>{error}</p>
          </div>
          <button
            onClick={handleLogout}
            className="mt-6 w-full rounded-lg bg-gray-600 px-4 py-2 text-white hover:bg-gray-700"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  const allUpcoming = [...todayTrips, ...upcomingTrips];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <a
                href="/driver/portal"
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeft size={20} className="text-gray-600" />
              </a>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  My Schedule
                </h1>
                {employee && (
                  <p className="text-sm text-gray-600 mt-1">{employee.name}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {!user && (
                <button
                  onClick={handleLogout}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
                >
                  Logout
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 text-center">
            <p className="text-sm text-gray-500">Today</p>
            <p className="text-2xl font-bold text-blue-600">
              {todayTrips.length}
            </p>
            <p className="text-xs text-gray-400">trips</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 text-center">
            <p className="text-sm text-gray-500">Upcoming</p>
            <p className="text-2xl font-bold text-green-600">
              {upcomingTrips.length}
            </p>
            <p className="text-xs text-gray-400">trips</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 text-center">
            <p className="text-sm text-gray-500">Completed</p>
            <p className="text-2xl font-bold text-gray-500">
              {pastTrips.length}
            </p>
            <p className="text-xs text-gray-400">trips</p>
          </div>
        </div>

        {tripsLoading ? (
          <div className="text-center py-16 text-gray-500">
            <div className="inline-block h-8 w-8 rounded-full border-4 border-solid border-blue-600 border-r-transparent mb-4"></div>
            <p>Loading your schedule...</p>
          </div>
        ) : allUpcoming.length === 0 && pastTrips.length === 0 ? (
          <div className="text-center py-16">
            <CalendarDays size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-600">
              No trips scheduled
            </h3>
            <p className="text-sm text-gray-400 mt-1">
              Your upcoming trips will appear here
            </p>
          </div>
        ) : (
          <>
            {/* Upcoming Trips Grouped by Date */}
            {Object.entries(groupedByDate).map(([dateStr, dateTrips]) => {
              const label = getDateLabel(dateStr);
              const isTodaySection = label === "Today";
              return (
                <div key={dateStr} className="mb-6">
                  <div className={`flex items-center gap-2 mb-3 px-1`}>
                    <CalendarDays
                      size={16}
                      className={
                        isTodaySection ? "text-blue-600" : "text-gray-400"
                      }
                    />
                    <h2
                      className={`text-sm font-bold uppercase tracking-wide ${isTodaySection ? "text-blue-600" : "text-gray-500"}`}
                    >
                      {label}
                    </h2>
                    <span className="text-xs text-gray-400 font-medium">
                      ({dateTrips.length} trip
                      {dateTrips.length !== 1 ? "s" : ""})
                    </span>
                    {isTodaySection && (
                      <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded bg-blue-600 text-white">
                        NOW
                      </span>
                    )}
                  </div>

                  <div
                    className={`bg-white rounded-lg shadow-sm border overflow-x-auto ${isTodaySection ? "border-blue-300" : "border-gray-200"}`}
                  >
                    <table className="w-full text-left">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Time
                          </th>
                          <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Booking #
                          </th>
                          <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Passenger
                          </th>
                          <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Pickup
                          </th>
                          <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Dropoff
                          </th>
                          <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Confirm
                          </th>
                          <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Vehicle
                          </th>
                          <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Driver Notes
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {dateTrips.map((trip) => {
                          const statusClasses = getStatusColor(trip.status);
                          const pickup = trip.pickup_address || "";
                          const dropoff =
                            trip.dropoff_address || trip.destination || "";
                          const isPendingConfirm =
                            trip.driver_accepted === "pending" ||
                            (!trip.driver_accepted &&
                              ![
                                "completed",
                                "cancelled",
                                "deleted",
                                "no-show",
                              ].includes(trip.status));
                          return (
                            <tr
                              key={trip.id}
                              className={`hover:bg-gray-50 transition-colors ${isTodaySection ? "border-l-4 border-l-blue-500" : ""} ${isPendingConfirm ? "bg-amber-50" : ""}`}
                            >
                              <td className="px-3 py-2 whitespace-nowrap">
                                <span className="text-sm font-bold text-blue-600">
                                  {formatTime(trip.start_time)}
                                </span>
                              </td>
                              <td className="px-3 py-2">
                                {trip.booking_number ? (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedTrip(trip);
                                    }}
                                    className="text-xs font-mono font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 hover:bg-blue-100 hover:border-blue-300 cursor-pointer transition-colors"
                                  >
                                    {trip.booking_number}
                                  </button>
                                ) : (
                                  <span className="text-xs text-gray-400 italic">
                                    —
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                <p className="text-sm font-semibold text-gray-900">
                                  {trip.client_name || "—"}
                                </p>
                                {trip.num_people && trip.num_people > 1 && (
                                  <p className="text-xs text-gray-500">
                                    {trip.num_people} passengers
                                  </p>
                                )}
                              </td>
                              <td
                                className="px-3 py-2 text-xs text-gray-600 max-w-[160px] truncate"
                                title={pickup}
                              >
                                {pickup || "—"}
                              </td>
                              <td
                                className="px-3 py-2 text-xs text-gray-600 max-w-[160px] truncate"
                                title={dropoff}
                              >
                                {dropoff || "—"}
                              </td>
                              <td className="px-3 py-2">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${statusClasses}`}
                                >
                                  {trip.status || "pending"}
                                </span>
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                {isPendingConfirm ? (
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() =>
                                        handleDriverResponse(
                                          trip.id,
                                          "accepted",
                                        )
                                      }
                                      className="inline-flex items-center gap-1 px-2 py-1 bg-green-600 text-white text-xs font-semibold rounded hover:bg-green-700 transition-colors"
                                    >
                                      <CheckCircle size={12} />
                                      Accept
                                    </button>
                                    <button
                                      onClick={() =>
                                        handleDriverResponse(
                                          trip.id,
                                          "declined",
                                        )
                                      }
                                      className="inline-flex items-center gap-1 px-2 py-1 bg-orange-500 text-white text-xs font-semibold rounded hover:bg-orange-600 transition-colors"
                                    >
                                      <XCircle size={12} />
                                      Decline
                                    </button>
                                  </div>
                                ) : trip.driver_accepted === "accepted" ? (
                                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded">
                                    <CheckCircle size={11} />
                                    Accepted
                                  </span>
                                ) : trip.driver_accepted === "declined" ? (
                                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded">
                                    <XCircle size={11} />
                                    Declined
                                  </span>
                                ) : (
                                  <span className="text-gray-400 italic text-xs">
                                    —
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-xs text-gray-600">
                                {trip.vehicle_name || (
                                  <span className="text-gray-400 italic">
                                    —
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-xs text-gray-600 max-w-[200px]">
                                {trip.driver_notes ? (
                                  <span
                                    className="bg-yellow-50 border border-yellow-200 px-2 py-1 rounded text-yellow-800 block truncate"
                                    title={trip.driver_notes}
                                  >
                                    {trip.driver_notes}
                                  </span>
                                ) : (
                                  <span className="text-gray-400 italic">
                                    —
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}

            {allUpcoming.length === 0 && (
              <div className="text-center py-12 mb-6">
                <CalendarDays
                  size={40}
                  className="mx-auto text-gray-300 mb-3"
                />
                <p className="text-gray-500 font-medium">No upcoming trips</p>
                <p className="text-sm text-gray-400 mt-1">
                  Check back later for new assignments
                </p>
              </div>
            )}

            {/* Past Trips Toggle */}
            {pastTrips.length > 0 && (
              <div className="mt-8">
                <button
                  onClick={() => setShowPast(!showPast)}
                  className="flex items-center gap-2 w-full text-left px-1 py-2 text-sm font-bold text-gray-500 uppercase tracking-wide hover:text-gray-700 transition-colors"
                >
                  {showPast ? (
                    <ChevronUp size={16} />
                  ) : (
                    <ChevronDown size={16} />
                  )}
                  Past Trips ({pastTrips.length})
                </button>

                {showPast && (
                  <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto mt-3">
                    <table className="w-full text-left">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Date
                          </th>
                          <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Time
                          </th>
                          <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Passenger
                          </th>
                          <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Pickup → Dropoff
                          </th>
                          <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 opacity-70">
                        {pastTrips.slice(0, 30).map((trip) => (
                          <tr
                            key={trip.id}
                            className="hover:bg-gray-50 transition-colors"
                          >
                            <td className="px-3 py-2 text-sm text-gray-700 whitespace-nowrap">
                              {new Date(trip.start_time).toLocaleDateString(
                                "en-US",
                                { month: "short", day: "numeric" },
                              )}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-600 whitespace-nowrap">
                              {formatTime(trip.start_time)}
                            </td>
                            <td className="px-3 py-2 text-sm font-medium text-gray-800">
                              {trip.client_name || "N/A"}
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-500 max-w-[220px] truncate">
                              {[
                                trip.pickup_address || trip.destination,
                                trip.dropoff_address,
                              ]
                                .filter(Boolean)
                                .join(" → ") || "—"}
                            </td>
                            <td className="px-3 py-2">
                              <span
                                className={`text-xs font-semibold px-2 py-0.5 rounded border ${getStatusColor(trip.status)}`}
                              >
                                {trip.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {pastTrips.length > 30 && (
                      <p className="text-xs text-gray-400 text-center py-2">
                        Showing 30 of {pastTrips.length} past trips
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* Trip Details Modal */}
      {selectedTrip && (
        <TripDetailsModal
          trip={selectedTrip}
          onClose={() => setSelectedTrip(null)}
        />
      )}
    </div>
  );
}
