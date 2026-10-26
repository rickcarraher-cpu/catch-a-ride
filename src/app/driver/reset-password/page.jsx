"use client";

import { useState, useEffect } from "react";

export default function DriverResetPasswordPage() {
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
        window.location.href = "/driver/portal";
      }, 3000);
    } catch (err) {
      console.error(err);
      setPasswordError("Failed to set password. Please try again.");
      setPasswordLoading(false);
    }
  };

  const containerClass =
    "min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900 p-4";
  const cardClass = "bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md";

  // ── SUCCESS ──────────────────────────────────────────────────────
  if (success) {
    return (
      <div className={containerClass}>
        <div className={`${cardClass} text-center`}>
          <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-12 h-12 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Password Set!
          </h1>
          <p className="text-gray-600 mb-6">Sign in with your new password.</p>
          <div className="flex items-center justify-center space-x-2 text-blue-600">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
            <span>Redirecting to portal...</span>
          </div>
        </div>
      </div>
    );
  }

  // ── STEP 1: ENTER EMAIL ──────────────────────────────────────────
  if (step === "email") {
    return (
      <div className={containerClass}>
        <div className={cardClass}>
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-white"
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
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              Forgot Password?
            </h1>
            <p className="text-gray-600 text-sm">
              Enter your email and we&apos;ll text you a 4-digit code.
            </p>
          </div>

          <form onSubmit={handleSendCode} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                autoFocus
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
                  Sending...
                </>
              ) : (
                "Send Verification Code"
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <a
              href="/driver/portal"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              ← Back to Sign In
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ── STEP 2: ENTER 4-DIGIT CODE ──────────────────────────────────
  if (step === "code") {
    return (
      <div className={containerClass}>
        <div className={cardClass}>
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              Enter Verification Code
            </h1>
            <p className="text-gray-600 text-sm">
              We sent a 4-digit code to <strong>{maskedPhone}</strong>
            </p>
          </div>

          <form onSubmit={handleVerifyCode} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                4-Digit Code
              </label>
              <input
                type="text"
                required
                maxLength={4}
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 4))
                }
                placeholder="1234"
                autoFocus
                className="w-full px-4 py-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-center text-2xl tracking-[0.5em] font-mono"
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

          <div className="mt-6 flex items-center justify-between">
            <button
              onClick={() => {
                setStep("email");
                setCode("");
                setCodeError("");
              }}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              ← Try different email
            </button>
            <button
              onClick={async () => {
                setCodeError("");
                try {
                  const res = await fetch("/api/auth/send-driver-reset-code", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email }),
                  });
                  if (res.ok) {
                    setCodeError("");
                    setCode("");
                    alert("New code sent!");
                  } else {
                    const data = await res.json();
                    setCodeError(data.error || "Failed to resend");
                  }
                } catch {
                  setCodeError("Failed to resend code");
                }
              }}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Resend Code
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── STEP 3: SET NEW PASSWORD ──────────────────────────────────────
  return (
    <div className={containerClass}>
      <div className={cardClass}>
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-white"
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
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            Set New Password
          </h1>
          <p className="text-gray-600 text-sm">
            Enter and confirm your new password below.
          </p>
        </div>

        <form onSubmit={handleSetPassword} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              New Password
            </label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password"
              autoComplete="new-password"
              spellCheck={false}
              data-gramm="false"
              data-gramm_editor="false"
              data-enable-grammarly="false"
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
            href="/driver/portal"
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            ← Back to Sign In
          </a>
        </div>
      </div>
    </div>
  );
}
