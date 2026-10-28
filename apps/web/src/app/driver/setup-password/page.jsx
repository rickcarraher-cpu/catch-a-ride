"use client";
import { useState, useEffect } from "react";

export default function SetupPasswordPage() {
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Get email and temp password from session storage
    if (typeof window !== "undefined") {
      const storedEmail = sessionStorage.getItem("driver_email");
      const storedPassword = sessionStorage.getItem("temp_password");

      if (storedEmail && storedPassword) {
        setEmail(storedEmail);
        setCurrentPassword(storedPassword);
      } else {
        // Redirect to login if no session data
        window.location.href = "/driver/login";
      }
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (newPassword.length < 4) {
      setError("Password must be at least 4 characters");
      return;
    }

    if (newPassword.trim() === "1234") {
      setError("Please choose a password other than the default");
      return;
    }

    setLoading(true);

    try {
      // Reset password
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email,
          current_password: currentPassword,
          new_password: newPassword.trim(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Failed to reset password");
        setLoading(false);
        return;
      }

      // Clear session storage
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("driver_email");
        sessionStorage.removeItem("temp_password");

        alert(
          "Password reset successfully! Please log in with your new password.",
        );
        window.location.href = "/driver/login";
      }
    } catch (err) {
      console.error("Password reset error:", err);
      setError("Failed to reset password. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-2">
          Reset Your Password
        </h1>
        <p className="text-sm text-gray-600 text-center mb-6">
          You must change your password from the default before continuing.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
            />
          </div>

          <div>
            <label
              htmlFor="newPassword"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              New Password
            </label>
            <input
              id="newPassword"
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter new password (min 4 characters)"
              disabled={loading}
            />
          </div>

          {/* confirm password field removed */}

          {error && (
            <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
          >
            {loading ? "Resetting..." : "Reset Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
