"use client";

import { useState, useEffect } from "react";

export default function ResetPasswordPage() {
  // Step: "email" | "code" | "newPassword"
  const [step, setStep] = useState("email");

  // Email step state
  const [email, setEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [maskedPhone, setMaskedPhone] = useState("");

  // Code step state
  const [code, setCode] = useState("");
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeError, setCodeError] = useState("");
  const [resetToken, setResetToken] = useState("");

  // New password step state
  const [newPassword, setNewPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [success, setSuccess] = useState(false);

  // Check for legacy token-based reset links
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get("token");
    if (tokenParam) {
      setResetToken(tokenParam);
      setStep("newPassword");
    }
    const emailParam = params.get("email");
    if (emailParam) {
      setEmail(emailParam);
    }
  }, []);

  // Step 1: Send 4-digit code via SMS
  const handleSendCode = async (e) => {
    e.preventDefault();
    setEmailError("");
    setEmailLoading(true);
    try {
      const res = await fetch("/api/auth/send-driver-reset-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEmailError(data.error || "Failed to send code");
        setEmailLoading(false);
        return;
      }
      setMaskedPhone(data.maskedPhone || "your phone");
      setStep("code");
    } catch (err) {
      console.error(err);
      setEmailError("Something went wrong. Please try again.");
    } finally {
      setEmailLoading(false);
    }
  };

  // Step 2: Verify the 4-digit code
  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setCodeError("");
    if (code.length !== 4) {
      setCodeError("Please enter the 4-digit code");
      return;
    }
    setCodeLoading(true);
    try {
      const res = await fetch("/api/auth/verify-reset-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCodeError(data.error || "Invalid code");
        setCodeLoading(false);
        return;
      }
      setResetToken(data.resetToken);
      setStep("newPassword");
    } catch (err) {
      console.error(err);
      setCodeError("Something went wrong. Please try again.");
    } finally {
      setCodeLoading(false);
    }
  };

  // Step 3: Set new password
  const handleSetPassword = async (e) => {
    e.preventDefault();
    setPasswordError("");

    if (!newPassword.trim()) {
      setPasswordError("Please enter a new password");
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await fetch("/api/auth/set-driver-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password: newPassword.trim(),
          resetToken,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPasswordError(data.error || "Failed to set password");
        setPasswordLoading(false);
        return;
      }
      setSuccess(true);
      setTimeout(() => {
        window.location.href = "/account/signin";
      }, 2000);
    } catch (err) {
      console.error(err);
      setPasswordError("Something went wrong. Please try again.");
    } finally {
      setPasswordLoading(false);
    }
  };

  // Success screen
  if (success) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl text-center">
          <div className="mb-6 flex justify-center">
            <div className="rounded-full bg-green-100 p-3">
              <svg
                className="h-12 w-12 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Password Reset Complete
          </h1>
          <p className="text-gray-600 mb-6">
            Your password has been successfully updated. Redirecting to sign
            in...
          </p>
          <div className="flex justify-center">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          </div>
        </div>
      </div>
    );
  }

  // Step 3: New Password
  if (step === "newPassword") {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-gray-900">
              Set New Password
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Enter your new password below
            </p>
          </div>

          <form onSubmit={handleSetPassword} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoFocus
                placeholder="Enter new password"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>

            {passwordError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                {passwordError}
              </div>
            )}

            <button
              type="submit"
              disabled={passwordLoading}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold transition-colors duration-200 flex items-center justify-center"
            >
              {passwordLoading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                  Setting Password...
                </>
              ) : (
                "Set Password"
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <a
              href="/account/signin"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              ← Back to Sign In
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Step 2: Verify Code
  if (step === "code") {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-gray-900">Enter Code</h1>
            <p className="mt-2 text-sm text-gray-600">
              We sent a 4-digit code to {maskedPhone}
            </p>
          </div>

          <form onSubmit={handleVerifyCode} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                4-Digit Code
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 4);
                  setCode(val);
                  setCodeError("");
                }}
                required
                autoFocus
                maxLength={4}
                placeholder="0000"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-center text-2xl tracking-widest font-mono"
              />
            </div>

            {codeError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                {codeError}
              </div>
            )}

            <button
              type="submit"
              disabled={codeLoading || code.length !== 4}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold transition-colors duration-200 flex items-center justify-center"
            >
              {codeLoading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                  Verifying...
                </>
              ) : (
                "Verify Code"
              )}
            </button>
          </form>

          <div className="mt-6 text-center space-y-3">
            <button
              onClick={() => {
                setStep("email");
                setCode("");
                setCodeError("");
              }}
              className="text-sm text-gray-600 hover:text-gray-800 font-medium"
            >
              ← Use a different email
            </button>
            <div className="text-sm text-gray-500">
              Didn't receive a code?{" "}
              <button
                onClick={handleSendCode}
                disabled={emailLoading}
                className="text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
              >
                Resend
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Step 1: Email
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">Reset Password</h1>
          <p className="mt-2 text-sm text-gray-600">
            Enter your email to receive a reset code
          </p>
        </div>

        <form onSubmit={handleSendCode} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailError("");
              }}
              required
              autoFocus
              placeholder="your@email.com"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
          </div>

          {emailError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {emailError}
            </div>
          )}

          <button
            type="submit"
            disabled={emailLoading}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold transition-colors duration-200 flex items-center justify-center"
          >
            {emailLoading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                Sending Code...
              </>
            ) : (
              "Send Reset Code"
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <a
            href="/account/signin"
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            ← Back to Sign In
          </a>
        </div>
      </div>
    </div>
  );
}
