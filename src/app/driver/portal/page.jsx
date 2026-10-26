"use client";

import { useEffect, useState } from "react";
import useUser from "@/utils/useUser";
import useAuth from "@/utils/useAuth";
import TripDetailsModal from "@/components/DriverPortal/TripDetailsModal";

export default function DriverPortalPage() {
  const { data: user, loading: userLoading } = useUser();
  const { signInWithCredentials } = useAuth();
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Driver login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // First-time password setup state
  const [firstTimeSetup, setFirstTimeSetup] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState("");
  const [driverName, setDriverName] = useState("");

  // Pending trips state
  const [pendingTrips, setPendingTrips] = useState([]);
  const [pendingTripsLoading, setPendingTripsLoading] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState(null);

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

    // Always require authentication — only fetch employee when user is logged in
    if (user) {
      fetchEmployee();
    } else if (!userLoading) {
      setLoading(false);
    }
  }, [user, userLoading]);

  const handleDriverLogin = async (e) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);

    try {
      const checkRes = await fetch("/api/auth/check-driver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail }),
      });

      if (!checkRes.ok) {
        const checkData = await checkRes.json();
        throw new Error(checkData.error || "Driver not found");
      }

      const checkData = await checkRes.json();

      if (!checkData.hasPassword) {
        setDriverName(checkData.driver?.name || "");
        setFirstTimeSetup(true);
        setLoginLoading(false);
        return;
      }

      if (checkData.forcePasswordReset) {
        window.location.href = `/driver/reset-password?email=${encodeURIComponent(loginEmail)}`;
        return;
      }

      const res = await fetch("/api/auth/verify-driver-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Invalid email or password");
      }

      const verifyData = await res.json();

      if (verifyData.driver?.force_password_reset) {
        window.location.href = `/driver/reset-password?email=${encodeURIComponent(loginEmail)}`;
        return;
      }

      const authRes = await fetch("/api/auth/driver-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail }),
      });

      if (!authRes.ok) {
        throw new Error("Failed to prepare authentication");
      }

      const authData = await authRes.json();

      await signInWithCredentials({
        email: loginEmail,
        password: authData.internalPassword,
        callbackUrl: "/driver/portal",
        redirect: true,
      });
    } catch (err) {
      console.error(err);
      setLoginError(err.message || "Invalid email or password");
      setLoginLoading(false);
    }
  };

  // Handle first-time password setup
  const handleFirstTimeSetup = async (e) => {
    e.preventDefault();
    setSetupError("");

    if (!newPassword.trim()) {
      setSetupError("Please enter a password");
      return;
    }

    setSetupLoading(true);
    try {
      const res = await fetch("/api/auth/set-driver-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: loginEmail,
          password: newPassword.trim(),
          confirm_password: newPassword.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSetupError(data.error || "Failed to set password");
        setSetupLoading(false);
        return;
      }

      setLoginPassword(newPassword);
      setFirstTimeSetup(false);

      const authRes = await fetch("/api/auth/driver-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail }),
      });
      if (!authRes.ok) throw new Error("Failed to prepare authentication");
      const authData = await authRes.json();

      await signInWithCredentials({
        email: loginEmail,
        password: authData.internalPassword,
        callbackUrl: "/driver/portal",
        redirect: true,
      });
    } catch (err) {
      console.error(err);
      setSetupError("Failed to set password. Please try again.");
      setSetupLoading(false);
    }
  };

  const handleLogout = () => {
    window.location.href = "/account/logout";
  };

  // Show first-time password setup
  if (firstTimeSetup) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900">
        <form
          onSubmit={handleFirstTimeSetup}
          className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl"
        >
          <div className="mb-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
              <svg
                className="h-8 w-8 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome{driverName ? `, ${driverName.split(" ")[0]}` : ""}!
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              This is your first time signing in. Please create a password for
              your account.
            </p>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                New Password
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Create a password"
                autoFocus
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            {setupError && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                {setupError}
              </div>
            )}

            <button
              type="submit"
              disabled={setupLoading}
              className="w-full rounded-lg bg-blue-600 px-4 py-3 text-base font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {setupLoading ? "Setting up..." : "Set Password & Sign In"}
            </button>

            <button
              type="button"
              onClick={() => {
                setFirstTimeSetup(false);
                setNewPassword("");
                setSetupError("");
              }}
              className="w-full text-center text-sm text-gray-500 hover:text-gray-700"
            >
              ← Back to login
            </button>
          </div>
        </form>
      </div>
    );
  }

  // Always show login form when not authenticated
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
              Sign in with your driver email and password
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
              <p className="mt-1 text-xs text-gray-500">
                First time here? Enter your email above and click Sign In —
                you'll be prompted to create a password.
              </p>
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

            <div className="text-center">
              <a
                href="/driver/reset-password"
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Forgot Password?
              </a>
            </div>
          </div>
        </form>
      </div>
    );
  }

  if (userLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg">
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-700">
            <h2 className="text-lg font-semibold mb-2">Access Error</h2>
            <p>{error}</p>
            <p className="mt-4 text-sm">
              Please contact your administrator if you believe this is a
              mistake.
            </p>
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Driver Portal
              </h1>
              {employee && (
                <p className="text-sm text-gray-600 mt-1">
                  Welcome, {employee.name}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              {employee?.is_admin && (
                <a
                  href="/"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                >
                  Admin Dashboard
                </a>
              )}
              <button
                onClick={handleLogout}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Pending Trips Alert Section */}
        {pendingTrips.length > 0 && (
          <div className="mb-8 bg-yellow-50 border-2 border-yellow-300 rounded-xl p-6 shadow-md">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-yellow-400 rounded-xl flex items-center justify-center shadow-sm">
                <svg
                  className="w-7 h-7 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-900">
                  Trips Awaiting Your Response
                </h2>
                <p className="text-sm text-gray-700 mt-0.5">
                  You have {pendingTrips.length} trip
                  {pendingTrips.length !== 1 ? "s" : ""} that need your
                  acceptance
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {pendingTrips.map((trip) => (
                <div
                  key={trip.id}
                  className="bg-white rounded-xl border-2 border-yellow-200 p-4 hover:shadow-lg transition-all hover:border-yellow-300"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <span className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold bg-blue-600 text-white shadow-sm">
                          {trip.booking_number || `#${trip.id}`}
                        </span>
                        <span className="text-base font-bold text-gray-900">
                          {trip.display_time}
                        </span>
                        <span className="text-sm text-gray-600 font-medium">
                          {trip.display_long_date}
                        </span>
                      </div>
                      <p className="text-lg font-bold text-gray-900 mb-2">
                        {trip.passenger_name}
                      </p>
                      <div className="text-sm text-gray-600 space-y-1">
                        {trip.pickup_address && (
                          <p className="truncate">
                            <span className="font-semibold text-green-700">
                              Pickup:
                            </span>{" "}
                            {trip.pickup_address}
                          </p>
                        )}
                        {(trip.dropoff_address || trip.destination) && (
                          <p className="truncate">
                            <span className="font-semibold text-red-700">
                              Dropoff:
                            </span>{" "}
                            {trip.dropoff_address || trip.destination}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedTrip(trip)}
                      className="flex-shrink-0 px-5 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold text-sm shadow-md hover:shadow-lg whitespace-nowrap"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Links Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {/* Today's Schedule */}
          <a
            href="/driver/schedule"
            className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-6 border border-gray-200"
          >
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-blue-100 rounded-lg p-3">
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
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <div className="ml-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  My Schedule
                </h2>
                <p className="text-gray-600 text-sm mt-1">
                  View your upcoming trips and daily schedule
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center text-blue-600 text-sm font-medium">
              View Schedule
              <svg
                className="ml-2 h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </a>

          {/* Earnings Report */}
          <a
            href="/driver/earnings"
            className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-6 border border-gray-200"
          >
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-green-100 rounded-lg p-3">
                <svg
                  className="h-8 w-8 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <div className="ml-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  My Timesheet
                </h2>
                <p className="text-gray-600 text-sm mt-1">
                  Review and approve your weekly timesheet &amp; pay
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center text-green-600 text-sm font-medium">
              Review &amp; Approve Timesheet
              <svg
                className="ml-2 h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </a>

          {/* Availability */}
          <a
            href="/driver/availability"
            className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-6 border border-gray-200"
          >
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-red-100 rounded-lg p-3">
                <svg
                  className="h-8 w-8 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <div className="ml-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  Manage Availability
                </h2>
                <p className="text-gray-600 text-sm mt-1">
                  Block time off for vacations, appointments, or personal time
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center text-red-600 text-sm font-medium">
              Manage Blocked Times
              <svg
                className="ml-2 h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </a>

          {/* Admin Dashboard link removed */}
        </div>

        {/* Info Box */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-blue-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-900">
                Payroll Information
              </h3>
              <div className="mt-2 text-sm text-blue-800">
                <p>
                  Payroll is processed weekly. Please review and approve your
                  mileage report each week to ensure accurate payment. You can
                  print your reports for your records.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
