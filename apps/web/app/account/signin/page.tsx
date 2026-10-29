"use client";
import { useState } from "react";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState("email");

  const handleEmailSubmit = (e) => {
    e.preventDefault();
    setStep("password");
  };

  if (step === "password") {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-gray-900">Sign In</h1>
            <p className="mt-2 text-sm text-gray-600">Enter your password</p>
          </div>
          <form className="space-y-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full rounded-lg border border-gray-200 px-4 py-3 text-lg outline-none focus:border-blue-500"
              />
            </div>
            <button
              type="button"
              className="w-full rounded-lg bg-blue-600 px-4 py-3 text-base font-medium text-white hover:bg-blue-700"
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setStep("email")}
              className="w-full text-center text-sm text-gray-500 hover:text-gray-700"
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
          <p className="mt-2 text-sm text-gray-600">Enter your email to sign in</p>
        </div>
        <form onSubmit={handleEmailSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full rounded-lg border border-gray-200 px-4 py-3 text-lg outline-none focus:border-blue-500"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-lg bg-blue-600 px-4 py-3 text-base font-medium text-white hover:bg-blue-700"
          >
            Continue
          </button>
        </form>
      </div>
    </div>
  );
}
