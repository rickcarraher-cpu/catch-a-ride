export async function GET(request) {
  // Create CSV template with headers and a sample row
  const headers = [
    "name",
    "phone",
    "email",
    "notes",
    "notification_preference",
    "street_address",
    "city",
    "state",
    "zip_code",
  ];

  const sampleRow = [
    "John Doe",
    "(555) 123-4567",
    "john@example.com",
    "Frequent traveler",
    "both",
    "123 Main St",
    "Nashville",
    "TN",
    "37201",
  ];

  const csvRows = [
    headers.join(","),
    sampleRow.map((val) => `"${val}"`).join(","),
  ];

  const csv = csvRows.join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition":
        'attachment; filename="passenger-import-template.csv"',
    },
  });
}
