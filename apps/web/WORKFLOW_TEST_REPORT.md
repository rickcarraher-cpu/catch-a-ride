# Booking workflow test report — November 3, 2026

## Verified hosted evidence

- Owner confirmed customer online booking completed.
- Review Orders screenshot shows TEST-21077 with NEEDS REVIEW status.
- Earlier owner confirmed assignment/unassignment and reload with unchanged time.
- Latest scoped request logs show assignment PATCH 200 and database GET 200.
- No /preview/database-edit request was present in the reviewed 11:03–11:09 UTC
  window. This does not exclude a later client failure, but matches the dead table
  Edit control found in source.

## Defects corrected in this audit

1. Database TripsTable was inside a disabled fieldset and onEdit was empty. Actual
   table Edit now navigates TEST rows to original editor. Non-test edits remain
   disabled, and Pay/Invoice/Delete controls remain disabled independently.
2. Original editor queries now reject HTTP errors rather than storing arbitrary
   response objects as data. Scoped vehicle category/assignment/current-trip reads
   are supplied; unsupported provider actions still return errors without network.
3. Auth tampering test occasionally replaced an already-x final cookie character
   with x (no change). Corrected regression to guarantee a changed encoded-value
   character. Re-ran auth suite; no auth implementation change or claim of an
   authentication vulnerability.

## Automated coverage — 63 passing tests across latest applicable suites

- 19 staff/security/business tests, including real isolated PostgreSQL workflow:
  new passenger -> one-way needs_review booking -> service lines/stored $84 subtotal
  -> tenant-scoped review retrieval -> metadata note edit -> driver assignment ->
  reload -> unassignment. Pickup timestamp, stored balance and mileage preserved.
- 5 recovered dashboard/navigation tests.
- 23 auth/reset/diagnostic tests (after deterministic tamper fixture correction).
- 2 original UI server-render tests: editor loads synthetic stored booking; table
  Edit enabled for TEST and financial/destructive buttons disabled.
- 7 wizard/transport tests, including editor blocked-provider operations.
- 3 isolated operations tests and 4 browser-workspace model tests.
- Final typecheck/build pass. Existing recovered-source
  source-map/unused-import warnings are not treated as runtime verification.

Tests use synthetic data, local PostgreSQL engine and/or renderToStaticMarkup.
No hosted customer record was edited by agent. A test passing does not prove every
browser gesture, deployed loader, schema constraint or integration works.

## Still NOT verified / NOT complete

- Complete hosted original editor browser load/save/reload. Limited notes/address/
  destination/flight/admin edits only, not time/services/price/passenger changes.
- Screenshot's zero balance and missing mileage: do not invent or recalculate values
  from UI. Regression proves stored nonzero values survive this path, not that the
  owner's booking had a nonzero submitted service price/distance. Hosted record
  verification is still needed.
- Review Orders approval/status changes and dispatch notifications.
- Customer round trips, recurring, tours/weddings, message-only and profile edits.
- Pricing/tax/fee parity, centralized-calculation enforcement and payment reconciliation.
- Real provider sandbox payments and designated test email/SMS delivery.
- Non-working dashboard features remain explicit unavailable notices, not implemented.
- Permanent staff sign-in, complete source-data migration, production cutover/rollback.

## Test access and next owner check

Vercel protection stays enabled; no public share or browser bypass is created.
Existing temporary scope/expiry (November 3 12:23 UTC) is unchanged. No production
settings/domain/data changes, messages or charges.

In the updated Review Orders queue, the actual table Edit button is connected for
TEST bookings. Change Notes only to a unique TEST phrase, Save Without Sending,
then reopen/refresh and verify the phrase persisted. Do not create a duplicate booking.
This is the next hosted check, not another claim of complete app readiness.
