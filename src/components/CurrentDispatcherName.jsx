"use client";

import useUser from "@/utils/useUser";

/**
 * Component that displays the current dispatcher's name.
 * Shows the logged-in user's name from the auth system,
 * which works correctly for both admin users and drivers.
 */
export default function CurrentDispatcherName({ fallback = "Admin" }) {
  const { data: user } = useUser();

  return <>{user?.name || fallback}</>;
}
