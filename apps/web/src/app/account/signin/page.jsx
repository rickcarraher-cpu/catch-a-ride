"use client";

import { useState } from "react";
import useAuth from "@/utils/useAuth";

export default function SignInPage() {
  const { signInWithCredentials } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Step: 'email', 'password', or 'role-choice'
  const [step, setStep] = useState("email");
  const [employee, setEmployee] = useState(null);
  const [hasPassword, setHasPassword] = useState(false);
  const [internalPassword, setInternalPassword] = useState(null);

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!email || !email.includes("@")) {
      setError("Please enter a valid email address");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/check-driver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        setLoading(false);
        return;
      }

      // Store employee info and move to password step
      setEmployee(data.employee);
      setHasPassword(data.hasPassword);
      setStep("password");
      setLoading(false);
    } catch (err) {
      console.error("Email check error:", err);
      setError("Failed to check email. Please try again.");
      setLoading(false);
    }
  };

  const handleCreatePassword = async (e) => {
    e.preventDefault();
    if (!password.trim()) {
      setError("Please enter a password");
      return;
    }

    if (password.trim().length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/set-driver-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: employee.id,
          password: password,
          confirm_password: password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create password");
        setLoading(false);
        return;
      }

      // Password created - now authenticate
      await authenticateUser(data.employee);
    } catch (err) {
      console.error("Create password error:", err);
      setError("Failed to create password. Please try again.");
      setLoading(false);
    }
  };

  const handleValidatePassword = async (e) => {
    e.preventDefault();
    if (!password.trim()) {
      setError("Please enter your password");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/verify-driver-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: employee.id,
          password: password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Invalid password");
        setLoading(false);
        return;
      }

      // Password validated - now authenticate
      await authenticateUser(data.employee);
    } catch (err) {
      console.error("Validate password error:", err);
      setError("Failed to verify password. Please try again.");
      setLoading(false);
    }
  };

  const authenticateUser = async (employeeData) => {
    try {
      // Sync with auth system
      const authRes = await fetch("/api/auth/driver-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employee_id: employeeData.id }),
      });

      const authData = await authRes.json();

      if (!authRes.ok) {
        setError(authData.error || "Authentication failed");
        setLoading(false);
        return;
      }

      const isAdmin = Boolean(employeeData.isAdmin);

      if (isAdmin) {
        // Admin user — show role choice screen
        setEmployee(employeeData);
        setInternalPassword(authData.internalPassword);
        setStep("role-choice");
        setLoading(false);
      } else {
        // Non-admin — sign in and go to driver portal
        console.log("🚗 Signing in as driver with email:", employeeData.email);
        await signInWithCredentials({
          email: employeeData.email,
          password: authData.internalPassword,
          callbackUrl: "/driver/portal",
          redirect: true,
        });
      }
    } catch (err) {
      console.error("Authentication error:", err);
      setError("Failed to sign in. Please try again.");
      setLoading(false);
    }
  };

  const handleRoleChoice = async (role) => {
    setLoading(true);
    setError(null);

    const redirectUrl = role === "admin" ? "/dashboard" : "/driver/portal";

    console.log("🎯 Role selected:", role);
    console.log("📧 Using email:", employee.email);
    console.log("🔑 Has password:", !!internalPassword);
    console.log("🏠 Redirect to:", redirectUrl);

    try {
      await signInWithCredentials({
        email: employee.email,
        password: internalPassword,
        callbackUrl: redirectUrl,
        redirect: true,
      });
    } catch (err) {
      console.error("❌ Role choice error:", err);
      setError("Failed to sign in. Please try again.");
      setLoading(false);
    }
  };

  const handleBackToEmail = () => {
    setStep("email");
    setPassword("");
    setEmployee(null);
    setHasPassword(false);
    setError(null);
  };

  if (step === "role-choice") {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-gray-900">
              Welcome, {employee?.name?.split(" ")[0] || "Admin"}
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              How would you like to sign in?
            </p>
          </div>

          {error && (
            <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <button
              onClick={() => handleRoleChoice("admin")}
              disabled={loading}
              className="w-full rounded-xl border-2 border-blue-600 bg-blue-600 px-4 py-5 text-white transition-all hover:bg-blue-700 hover:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center justify-center gap-3">
                <svg
                  className="w-6 h-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
                  />
                </svg>
                <div className="text-left">
                  <div className="text-lg font-semibold">Admin Dashboard</div>
                  <div className="text-sm text-blue-100">
                    Manage trips, drivers, and operations
                  </div>
                </div>
              </div>
            </button>

            <button
              onClick={() => handleRoleChoice("driver")}
              disabled={loading}
              className="w-full rounded-xl border-2 border-gray-300 bg-white px-4 py-5 text-gray-900 transition-all hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center justify-center gap-3">
                <svg
                  className="w-6 h-6 text-gray-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <div className="text-left">
                  <div className="text-lg font-semibold">Driver Portal</div>
                  <div className="text-sm text-gray-500">
                    View your trips and earnings
                  </div>
                </div>
              </div>
            </button>
          </div>

          {loading && (
            <div className="mt-6 flex items-center justify-center gap-2 text-sm text-gray-500">
              <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-blue-600 border-r-transparent"></div>
              Signing in...
            </div>
          )}

          <button
            onClick={handleBackToEmail}
            className="mt-6 w-full text-center text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            ← Use a different email
          </button>
        </div>
      </div>
    );
  }

  if (step === "password") {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-gray-900">
              {employee?.name || "Sign In"}
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              {!hasPassword
                ? "No password on file. Enter a new password."
                : "Enter your password"}
            </p>
          </div>

          <form
            onSubmit={
              hasPassword ? handleValidatePassword : handleCreatePassword
            }
            className="space-y-6"
          >
            {!hasPassword ? (
              <>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    New Password
                  </label>
                  <div className="overflow-hidden rounded-lg border border-gray-200 bg-white px-4 py-3 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
                    <input
                      required
                      type="password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (error) setError(null);
                      }}
                      placeholder="Enter new password"
                      className="w-full bg-transparent text-lg outline-none"
                      autoFocus
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <div className="overflow-hidden rounded-lg border border-gray-200 bg-white px-4 py-3 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
                  <input
                    required
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="Enter your password"
                    className="w-full bg-transparent text-lg outline-none"
                    autoFocus
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 px-4 py-3 text-base font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? "Signing in..."
                : hasPassword
                  ? "Sign In"
                  : "Create Password"}
            </button>

            {hasPassword && (
              <div className="text-center">
                <a
                  href="/account/reset-password"
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Forgot Password?
                </a>
              </div>
            )}

            <button
              type="button"
              onClick={handleBackToEmail}
              className="w-full text-center text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              ← Back to Email
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">Welcome</h1>
          <p className="mt-2 text-sm text-gray-600">
            Enter your email to sign in
          </p>
        </div>

        <form onSubmit={handleEmailSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white px-4 py-3 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full bg-transparent text-lg outline-none"
                autoFocus
              />
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 text-base font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Checking..." : "Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
