# Desktop acceptance readiness — November 3

This is NOT an all-functions-ready release. Do not switch production based on this
checklist. Separate test database; external charges/customer communications disabled.

## Consolidated daily workflow (implementation present)

1. Customer online one-way booking: owner completed; needs_review queue screenshot
   confirmed. Latest full browser replay not run by agent.
2. Dispatch one-way booking/new passenger/service subtotal: owner completed earlier;
   automated isolated database create/read regressions pass.
3. All Trips/search/TEST filter/date-linked timeline: implemented; limited owner use.
4. Review Orders queue: owner confirmed record. TEST-only approval/rejection now
   implemented, needs hosted verification. No notification is sent on approval.
5. Notes/address/destination/flight metadata edit: original editor connected;
   visible table Edit fixed. Server-render and isolated SQL checks pass; actual
   hosted editor save/reload still unverified.
6. Assignment/unassignment: owner confirmed persistence and unchanged time.
7. Specific vehicle selection: tenant/driver-checked save locally tested;
   latest hosted selection persistence unverified.

## Limited, not full daily-workflow coverage

- Settings: eight ordinary business keys writable by real app admin only.
  Current temporary capability does not authorize admin settings writes.
- Passenger creation/lookup: implemented. Existing profile editing not implemented.
- Vehicles/drivers: selected reads/fixtures, not full management CRUD.
- Pricing: service subtotal stored, no certification of complete legacy
  taxes/fees/commissions or unified calculation enforcement.
- Timeline duration remains illustrative 60 minutes, not actual service duration.
- TEST-only review/editor/assignment actions cannot change imported non-test trips.

## Not ready; must be completed before broad acceptance

- Full booking edit/time/service-price editing and conflict/concurrency behavior.
- Round trips, recurring, tours/weddings and message-only booking.
- Calendars, reports/payroll/expenses, availability/blocked-time management,
  service/vehicle/category/passenger CRUD and all financial workflows.
- Real provider sandbox payment/refund/reconciliation and designated test
  email/SMS delivery. No providers configured or triggered by this work.
- Backup/export/import completeness and verified restore/reconciliation.
- Permanent app identity, removal of temporary branch bypass, production data
  final sync/change-freeze/rollback reconciliation and explicit cutover approval.

## Access

Current owner-approved exact-branch Vercel-protected window ends November 3 12:23 UTC.
No extension or broader app login is implied. Do not create public share/bypass links.
No repeated owner patch-by-patch acceptance requested: remaining integrations should
be completed/tested first. Automated tests do not replace deployed browser acceptance.

## Next concrete prerequisites for blocked integration tests

- Permanent supported staff login or separately approved bounded review, as needed.
- Payment provider sandbox configuration entered privately by credential owner.
- Explicit designated test message recipients and working sender configuration.
- Original unfinished business rules confirmed before implementing new behavior.

These prerequisites do not prevent independent code/test work on local synthetic
records. They DO prevent an honest claim that every dashboard function is ready.

## Messages follow-up

Original Messages page now has a database-history route instead of unfinished
placeholder. Tenant-scoped list/thread reads and unread filtering implemented with
visible error state and bounded history limits. This does NOT complete messaging:
sending/replies, mark read/urgent, deletion, recipient lookup, participant aggregation
and pagination are still blocked/incomplete. No fake sent-success is returned.
Hosted schema/history UI not verified; imported message columns inferred from
original source and exercised against synthetic SQL schema only. Tests do not prove
all dashboard actions connected; this remains explicitly incomplete.

## Four-screen read batch

Original Drivers, Vehicles, Passengers and Services now have protected database-backed
read routes `/preview/manage/:section`, linked from original dashboard together.
Selected driver fields omit passwords/tokens; vehicle ownership checks include
legacy owner and reject cross-tenant assignments. Passengers use 200-row pages with
separate page selector; services/drivers/vehicles capped at 500, assignments 1000.
Original mutation controls (and internal filters) disabled via read-only fieldset.
Create/update/delete/profile/service/category/assignment management is NOT delivered
by this batch. Dedicated transport rejects mutations and unknown reads; no simulation
is presented as saved. Hosted imported schemas/UI still unverified; query-boundary
regression passes but is not database/browser acceptance. No provider calls or
production changes; temporary review expiry November 3 12:23 UTC unchanged.


## Schema-backed management saves — November 3

Owner supplied complete 64-table structural report. Local management regression
schema now uses reported column types/nullability, primary keys and relevant foreign
keys; only ID sequence defaults modeled, not business default values.
Original Drivers/Passengers/Services create and edit now have allowlisted tenant
writes. No password/admin/dispatcher changes; staff-email takeover is rejected.
Vehicles create/update with driver ownership and junction assignments in one
transaction; surviving assignment profiles preserved. Unowned/shared-across-tenant
vehicles rejected, not guessed as tenant 1. Original form cache invalidation and
error reporting corrected; test transport never claims unsuccessful save success.
During existing approved window through November 4 00:51 UTC, tenant-1 protected
management saves enabled. Outside that window real app admin login is required.
New workflow makes actual TEST DATABASE changes, not browser samples. Hosted
records are not altered automatically in verification.

Still excluded: hard deletion, credential/role administration, profile upload/image
provider, embedded blocked-time writes and per-vehicle profile editing. Reports,
advanced bookings, financial actions, and broad all-functions parity remain
unfinished. This update must not be described as whole-system acceptance ready.

## Daily/print schedule batch
Original daily schedule and Print Schedule restored with shared one-day database
read service: Central Time half-open day bounds, including 23/25-hour DST days.
Driver grouping includes inactive drivers if they have scheduled trips or blocks;
company name, original service lines, blocked-time overlaps, and stored trip totals
read from test database. No independent repricing or payment inference from
transactions. Daily date navigation/search/grouping and print layout enabled.
TEST-row Edit routes to existing limited editor; imported trips and financial/
delete/send actions stay protected. Print SMS/email control disabled and transport
rejects all writes. Read caps fail visibly rather than print incomplete schedules.
No mobile tests per owner's scope. No production changes or access expiry extension.
Calendars, broader reports and outstanding full-system work remain incomplete.

## Original calendar batch
24-Hour Calendar Grid and Calendar at a Glance connected to scoped schedule reads.
Day grid uses Central Time hours and original search/status/driver filters, includes
inactive drivers with trips, and opens read-only imported trip details. TEST Edit
opens existing limited editor; payment and deletion remain disabled. Paid filters
use stored payment_status and detail total uses stored services_total, not a second
fare sum. Month counts load only selected month (5000 cap, explicit overflow failure),
exclude cancelled/deleted/tentative and use Central Time month boundaries. Month
navigation normalizes to day 1 to avoid Jan 31 skipping February; day click opens
original protected calendar. No external calls or database mutations. Existing
access expiry unchanged. Tests distinguish month counts/day details from full
functional parity; financial/advanced/report features remain unfinished.

## Original report batch
All Trips (daily/date/search/print), Trips by Driver (Sun–Sat/driver and dispatch
views/print), and Unpaid Trips (stored balance/method grouping/refresh) restored.
Fare/tip fields read from appointments.services_total/tips_total; no second add-on
reconstruction included. Group/report sums aggregate these stored amounts. Unpaid
balances use stored balance_due, exclude paid/cancelled/deleted, include past and
future dates. Operational payment URLs and message contents never returned; only
pending-link metadata (provider/status/created date) is visible; resend disabled.
Existing TEST editor reachable; imported rows read-only. Days/weeks bounded to
500/3500 records and unpaid capped at 5000 with visible rejection on overflow.
Local schema tests cover .10+.20 balances, tenant/foreign service joins, stored
fare versus line-price disagreement, cancelled-week rows, and date limits.
No writes, production/provider actions or access-window extension by this batch.
Still not whole-app readiness; other reports/financial/advanced actions incomplete.

## Availability and history batch
Original Blocked Times, Manage Availability, Communication Log restored.
One-time availability create/edit/soft-delete scoped through owning employees;
Central timestamp validation, end>start/max-one-year bounds, and same-origin checks.
Recurring definitions read-only, no generation or bulk cleanup. Soft deletion
preserves records/history; no external notifications. Communication log pages are
100 email and 100 SMS records each, filters/search page-local. Raw HTML never
executed and operational URLs stripped from history; error/metadata blobs excluded.
No resend or send functions activated. Existing protected window unchanged.
Owner previously deferred trip editor's blocked vehicle changes; still unfinished.
Not whole-system readiness; recurring/advanced/payment/report work still remains.

## Expense and daily-review batch
Original Expenses period navigation and Record Expense form connected. Tenant-scoped
stored expense reads capped at 5000/year; new expense-only records stamped TEST ONLY
and posted_by TEST PREVIEW EXPENSE. No appointment/payment/payroll fields accepted,
no processing or imports/financial deletion. Expense categories read from stored
expense_categories setting or original form defaults; no category write here.
Original 5 PM report uses shared Central-day schedule data and stored passenger/
driver confirmation flags; no reminders sent. Receipts Needed uses extracted original
dashboard modal, date selector and stored needs_receipt flag/amount only. Find Trip
links to existing list; receipt document creation/sending not implemented. Original
receipt flag list includes cancelled flagged trips (matches legacy source), excludes
deleted; date bounded explicitly for DST. No automatic hosted data writes by tests.
Access expiry unchanged. Special-equipment passenger-note change remains pending
clarification; no ambiguous request text was copied into passenger profiles.

## Payment report / recurring-review batch
Original Weekly Payments and Payments by Method connected to bounded <=32-day
Central payment_date reads, tenant-scoped passenger/driver joins and stored
payments_total/tips_total. No provider reconciliation or payment mutation; figures
are copied trip snapshots by payment_date, not a certified transaction-ledger audit.
Original week toggles/print controls restored; TEST row navigation goes to limited
editor. Recurring Trips original table shows imported active definitions, time,
frequency, driver, occurrences and stored service durations; all generators and
create/edit/delete disabled. This is read-only recurring review, not completion of
recurring booking functionality. Existing access expiry unchanged.
