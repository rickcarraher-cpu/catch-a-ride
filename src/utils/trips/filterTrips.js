export function filterTrips(
  trips,
  statusFilter,
  search,
  searchType = "passenger",
) {
  if (!trips || !Array.isArray(trips)) return [];

  const filtered = trips.filter((trip) => {
    // Special cases for payment status filters
    let statusMatch;
    if (statusFilter === "all") {
      statusMatch = true;
    } else if (statusFilter === "paid") {
      // Trust DB payment_status first
      statusMatch = trip.payment_status === "paid";
    } else if (statusFilter === "partial") {
      // Partially paid trips
      statusMatch = trip.payment_status === "partial";
    } else if (statusFilter === "unpaid") {
      // Unpaid trips - trust DB payment_status
      statusMatch = trip.payment_status !== "paid";
    } else if (statusFilter === "needs_review") {
      // Show all trips with needs_review status
      statusMatch = trip.status === "needs_review";
    } else if (statusFilter === "tentative") {
      // Tentative is a boolean flag, not a status value
      statusMatch = trip.is_tentative === true;
    } else {
      // Regular status filter (confirmed, cancelled, approved, in-progress, etc.)
      statusMatch = trip.status === statusFilter;
    }

    const searchTrimmed = (search || "").trim();
    const searchLower = searchTrimmed.toLowerCase();
    let searchMatch = true;

    if (searchTrimmed) {
      // Split into words for better matching ("Sara Herbert" → ['sara', 'herbert'])
      const searchWords = searchLower.split(/\s+/).filter((w) => w.length > 0);

      if (searchType === "passenger") {
        // Each word must appear in name, email, or phone
        searchMatch = searchWords.every(
          (word) =>
            trip.client_name?.toLowerCase().includes(word) ||
            trip.client_phone?.toLowerCase().includes(word) ||
            trip.client_email?.toLowerCase().includes(word),
        );
      } else if (searchType === "booking") {
        // Search by booking number only (use full string)
        searchMatch = trip.booking_number?.toLowerCase().includes(searchLower);
      } else if (searchType === "driver") {
        // Each word must appear in driver name
        searchMatch = searchWords.every(
          (word) =>
            trip.employee_name?.toLowerCase().includes(word) ||
            trip.requested_driver_name?.toLowerCase().includes(word),
        );
      } else if (searchType === "destination") {
        // Search by destination, dropoff address, or dropoff street
        searchMatch =
          trip.destination?.toLowerCase().includes(searchLower) ||
          trip.dropoff_address?.toLowerCase().includes(searchLower) ||
          trip.dropoff_street?.toLowerCase().includes(searchLower);
      }
    }

    return statusMatch && searchMatch;
  });

  // Sort all trips by date/time ascending (soonest first)
  return filtered.sort((a, b) => {
    const aTime = new Date(a.start_time).getTime();
    const bTime = new Date(b.start_time).getTime();
    return aTime - bTime;
  });
}
