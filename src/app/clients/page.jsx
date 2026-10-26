"use client";

import React, { useEffect } from "react";

export default function ClientsRedirect() {
  useEffect(() => {
    window.location.replace("/passengers");
  }, []);
  return null;
}
