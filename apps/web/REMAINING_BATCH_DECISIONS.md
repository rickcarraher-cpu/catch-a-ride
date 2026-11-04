# Remaining batch: unresolved decisions, not acceptance-ready

Owner requested all seven remaining dashboard destinations as one testable batch.
Do not hand off a partial release as that outcome. Current protected testing deadline
remains November 4 13:12 UTC; production and signup project excluded.

## Confirmed blockers needing owner decision

### Timesheet / payroll
Original `api/timesheets` reconstructs commission as services_total times effective
rate and adds computed gas reimbursements, tips, and cash deductions. Original
Payments page also independently estimates commission as 20% of payment amounts.
This conflicts with owner's stated direction to read Trip database values and not
recalculate differently in reports. Need explicit decision: historical stored
`driver_commission` as authoritative, with missing values flagged unavailable, or
preserve legacy live formula until centralized migration is separately reviewed.
Do not substitute zero for missing payroll or certify unreconciled copies as payroll.

### Weddings 2 ownership
Owner-supplied schema shows wedding_bookings_2 has no tenant_id, client_id, wedding_id
or other verified business-ownership relation. This is distinct from weddings table
which has tenant_id. Need explicit mapping of existing Wedding 2 rows to tenant(s),
and a tenant-aware schema migration/export. Do not expose every row as tenant 1.
This affects two destinations: /weddings-2 and /weddings-2/review.

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
