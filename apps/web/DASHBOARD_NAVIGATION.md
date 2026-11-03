# Dashboard navigation checkpoint

Database dashboard enabled destinations:
- All Trips: searchable tenant-scoped database results.
- Review Orders: same result screen filtered to needs_review; read-only review, no approval/send action.
- Dispatch Book a Trip: original dispatcher test-database wizard.
- Online Booking Link: original customer online test wizard.
- Assign Drivers: original database timeline.
- Settings: original database settings with existing scoped write protections.

All remaining original anchor destinations now navigate to a protected, explicitly
"Not connected for testing yet" page. This is navigation coverage, NOT functional
restoration. Includes calendars, reports, messages, drivers/vehicles/passengers,
recurring, blocked times, services, tours/weddings, financial/payroll and availability.
Original Close Up/receipt/other action buttons similarly navigate to unfinished
notices instead of performing destructive or integration actions. No silent sample
substitution. Unknown external/protocol links remain disabled.

Review Orders filters status in parameterized tenant-scoped SQL, preserves query
pagination/status, and does not send dispatch notifications or modify booking status.
The approved temporary access expiry remains November 3 12:23 UTC; no extension.
Production, payment/message providers, cleanup/import/backup mutations unchanged.
