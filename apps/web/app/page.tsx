"use client";
import { useEffect } from "react";

export default function HomePage() {
  useEffect(() => {
    window.location.href = "/account/signin";
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-white border-r-transparent"></div>
        <p className="mt-4 text-white">Loading...</p>
      </div>
    </div>
  );
}
