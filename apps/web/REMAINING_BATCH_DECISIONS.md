# Remaining batch: unresolved decisions, not acceptance-ready

Owner requested all seven remaining dashboard destinations as one testable batch.
Do not hand off a partial release as that outcome. Current protected testing deadline
remains November 4 13:12 UTC; production and signup project excluded.

## Owner decisions resolved November 4

Payroll: owner corrected the earlier statement. Commission is calculated, not
stored authoritatively. Preserve inspected live calculation using stored Trip
inputs, service reimbursements, and cash ledger deductions; place in one shared
server module. Stored driver_commission is not trusted. Default-rate/fallback
behavior deliberately preserved from inspected legacy code; test with actual
business examples before payroll use.

Weddings 2: owner explicitly confirms all existing records belong to tenant 1 and
that this feature is under development. Read policy is an explicit legacy-table
ownership rule, not a generic fallback. Tenant 2 must be rejected. No schema
mutation or assumption about future multi-tenant writes. Original form/review may
be inspected, but unverified writes and external sends stay blocked.

## Still implementation work, not owner blockers
- /trips?new=true&tour=true: original advanced tour booking persistence/participants/
  itinerary; no claim of completion from a review-only list.
- /unfinished-action is specifically Add Trips to Wedding, not generic navigation:
  original dashboard button at weddings section redirects /weddings/add-trip.
- /close-up original action requires a verified backup, not a flag-only success.
  New checklist exposes counts but no backup/restore certification.
- /payments supports original ledger and safe manual TEST-only recording/reversal;
  provider processing remains excluded. Original payment modal not reused as though
  sandbox provider calls work. New dialog is clearly labeled TEST ONLY.

## Ledger pagination
200 records per page; displayed totals are page-only, not full accounting totals.
Search is tenant-scoped and page-selected; no historical data silently discarded.

## Manual test payment safeguards
Only TEST bookings in current tenant; fixed TEST MANUAL method; no cards/provider
identifiers, tips/payroll/foreign booking fields accepted. Positive cent precision,
stored balance/totals required, no overpayment. Request key serialized by advisory
lock; identical retries reuse ledger entry, conflicting retries fail. Booking and
ledger updates occur in a transaction. Reversal appends negative test entry once,
retains original record, and updates only stored totals. Imported payments cannot
be reversed by this route. No automatic hosted payment write in verification.
