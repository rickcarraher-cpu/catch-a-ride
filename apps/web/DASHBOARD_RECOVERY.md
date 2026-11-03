# Original dashboard recovery (view-only milestone)

The dashboard and its 54 reachable UI source files under `src/` are recovered from `b4d543ba3e1ea749d6c9ee2438887092831a9185`,
which contains the October 27 Anything export. It was deleted by `ff690ca` on October 29.
The user confirmed there were no newer Anything changes to carry over.

## What is available

`/preview/dashboard` renders the original dashboard layout only when
`VERCEL_ENV=preview`; all other environments return 404. It does not require an app
login because it exposes no database data or service functionality. It is not a
login bypass: `/dashboard` and the existing authentication routes are unchanged.

The renderer runs only on the server, using an isolated empty React Query cache.
No React effects run and no fetches are made. The browser receives static markup,
not the legacy components' event handlers. Buttons/inputs are disabled, links have
no `href`, and a prominent banner explains the disconnected/view-only state.
No customer records, live credentials, emails, payments or write-capable endpoints
are connected. Legacy API source remains in Git history and is **not restored or registered** as routes.
Do not enable those APIs wholesale: they retain legacy auth/platform dependencies and
need explicit authorization/tenant isolation/security review before use.

The recovered dashboard differs from its historical source only by removal of an
unused legacy `useUser` call and by synchronous imports for static rendering.
The pre-existing small TypeScript components in `src/components` are retained.

## Verification

- `bunx tsx --test test/recovered-dashboard.test.ts` covers service-free rendering,
  disabled controls and the fail-closed Preview gate.
- `bun run test:auth`, `bun run typecheck`, `bun run build` cover existing auth and
  compilation. The database tests use isolated in-memory PostgreSQL, not live data.
- Browser verification is required on the PR head's READY Preview before reporting
  visual recovery complete.

## Not complete

This is not a functioning migration. Booking, drivers, payments, emails, private
records, tenant isolation in legacy services and successful live sign-in remain
unverified/unconnected. Production data migration and domain cutover are separate
explicitly approved work. Do not merge this as a claim of production readiness.

## Interactive isolated test workspace

`/preview/workspace` is a separate sample-data application gated by the same
Preview-only loader. It is not connected to the original legacy APIs or database,
and is not a finished migration. It supports trip create/edit, status changes,
driver creation/removal/assignment, search/filter, and confirmed reset to samples.
State is validated on load and saved to versioned localStorage only on explicit
user actions. Storage failures are reported without claiming a save. No service
requests or server actions are implemented. Never enter real customer information.
State is per browser AND preview origin; a new deployment address has a separate
workspace. Clearing browser storage removes samples; there is no cloud sync.
Existing protected app routes are unchanged. Payment and communication integrations
remain disconnected. Run `bun run test:workspace` for model/validation checks.

## Original Book A Ride wizard

`/preview/book` uses the October 27 `DispatchBookingWizard` and its original
BookingWizard components (layout/text/steps preserved, no replacement form).
Recovered wizard fetch calls are lexically imported from a sample-only adapter;
global fetch is never overridden, and **no legacy backend route is registered**.
The adapter never calls the network. Supported settings, vehicles, lookup, client
and booking operations use explicit example fixtures/browser storage only.
Unsupported routes return 501, never silently falling through to live services.
Original notification controls remain visually present for comparison but no
notifications or charges can run; the persistent sample banner states this.
Mileage must be entered manually; distance-service calls, recurring trips,
message-only submissions and weddings integrations remain disconnected.

The original UI source is preserved except for sample-fetch imports, typed wrapper
props and back/success navigation to sample routes. Global sign-in styles are
scoped so they do not alter original wizard controls. Example prices/settings and
fixture content are not live business configuration. A banner and isolated URLs
are intentional visible differences; no assertion of pixel-perfect/full parity.

Bookings persist their full legacy payload (for clone lookup) separately from the
practice list projection. Tests cover no-network failures, lookup, client creation,
booking projection persistence, cloning and rollback on storage errors. Resetting
samples in the practice workspace clears wizard fixtures as well. Sample details
only: browser storage is not suitable for private information.

## Original desktop assignments and settings — isolated samples

`/preview/assignments` restores the original Schedule Timeline with sample drivers
and booked-date trips projected from browser storage. Supported PATCH assignments,
unassignment and rescheduling save locally; notifications remain blocked regardless
of UI send options. Synthetic numeric driver IDs map to workspace driver IDs without
changing existing stored data. Chicago time conversion is explicit.

`/preview/settings` restores the original Settings 2 tabs/components. Only explicit
ordinary-setting keys (business name/contact/hours, sample rates, feature toggles,
booking message, passenger defaults) can save to a separate browser key. Credential,
auth-bypass, payment-service, cleanup, upload and unknown routes fail closed; no
real credentials should be entered. Sample settings feed the original booking wizard.
These are not imported live settings and are not database-backed. Both routes are
Preview-only; protected app routes remain unchanged. Dashboard navigation maps to
these isolated routes. Original components are retained with only sample fetch
imports, removed value-debug logs and isolated back navigation.

Desktop verification only by user request. Full drag/drop, conflict management,
notifications, blocked times and all settings panels are not established as working
until explicitly verified; adapter tests are not proof of full interaction parity.

## Two-vehicle booking fixture

The original booking wizard has Sample Sedan (4 passengers) assigned to the first
sample driver and Sample SUV (6 passengers) assigned to the second sample driver.
Vehicle/category reads use the same fixtures; driver filtering excludes the other
vehicle. Booking saves reject unknown or mismatched sample driver/vehicle pairs.
Tests cover both mappings, mismatch rejection and saved vehicle ID. These are not
28 migrated vehicles or vehicle-management CRUD; real source records remain absent.
No live database, driver, vehicle, message or payment operation is performed.

## Protected database read milestone

`/preview/database` is Preview-only and requires the existing signed database-backed
session plus exactly one explicit employee membership. Admin/dispatcher flags allow
staff access independently of driver is_active. Driver-only, missing or ambiguous
memberships fail closed; no override cookie or tenant-1 fallback exists.

Appointments are read in bounded pages with explicit fields and tenant-scoped client/
employee joins. Safe business settings are allowlisted; employee credentials,
confirmation/reset tokens, integration secrets and sending flags are never returned.
No data writes or service actions exist. The original dashboard layout remains, but
its enabled navigation explicitly stays in isolated sample routes. Database records
appear separately in a disabled original trip table. This is a read-only milestone,
not a complete operational migration. Successful user login and actual database
records remain unverified until a test-account holder signs in on this deployment.

## Temporary owner-approved read review

Dedicated branch `preview/temporary-read-review` skips only the app-password gate
on `/preview/database` until 2026-11-02 19:28 UTC. It requires Preview environment
and exact branch metadata, and defaults closed at expiry/elsewhere. It returns only
tenant 1 bounded read-only records using the existing field/settings allowlists.
It creates no app cookie, grants no staff/write role, and does not change sign-in,
production, database values or other protected routes. Existing form sign-in remains.

Security boundary: Vercel Authentication MUST remain enabled on this deployment.
This allows Vercel-authorized viewers, not a verified app identity. Do not create a
share/bypass link or open this deployment using a browser tool that creates one.
Inspect deployment-specific SSO protection before handing the URL to the owner.
This is time-limited review, NOT public email-only authentication or a permanent
production access design. After expiry the normal app sign-in is required again.
A follow-up may remove this branch's temporary code entirely; no automatic commit
is scheduled. Already displayed/downloaded records cannot be recalled at expiry.

## Imported database assignment/settings read review

Original screens at `/preview/database-assignments` and `/preview/database-settings`
use tenant-scoped server reads instead of browser fixtures. API GET routes authenticate
via existing staff session or the existing exact-branch expiring Vercel-protected
read gate. No expiry extension. Every API action returns 405. Unknown reads return
404/501 rather than fall through to legacy services. Settings controls disabled;
timeline dragging suppressed while date selection remains usable. Sensitive driver
and booking tokens/passwords are not selected. Timeline durations are explicitly
illustrative 60 minutes, not verified actual service durations. More than 500 trips
on a date fails visibly rather than silently truncating. Does not implement booking,
assignment or settings writes. Those remain blocked without verified app staff sign-in.

## First controlled database write: driver assignment

Dedicated Preview exposes PATCH assignment only to verified app sessions resolved
through explicit admin/dispatcher membership. Temporary review never grants write
rights; its original branch/expiry remains unchanged. Same-origin POST protection,
method/resource/ID/body validation and tenant-bound UPDATE/eligible-driver EXISTS
are enforced. Assignment/unassignment cannot change start_time. No customer messages,
payments or legacy handler side effects run. Other mutations are still disabled.

Mock-query regressions cover bind values, absence of time/service writes, temporary
review rejection, invalid input and cross-tenant/not-found failure. These are not
live database write verification. A valid private test account session remains a
blocking prerequisite for interactive database-write tests. Settings and booking
creation writes are not implemented by this milestone. No live database or domain
changes; do not promote as production ready.

## Settings writes and basic booking API

Verified app staff can POST `resource=booking` on the Preview database API. Supports
existing same-tenant passenger, optional eligible driver, explicit-offset pickup time,
addresses, notes, passenger count and vehicle category only. Unknown fields—including
payment/notification/service payloads—fail closed. Transaction wraps ownership checks
and insert; pending status and TEST DATABASE booked_by are explicit. No pricing,
service rows, booking-number generation, round trips or new passenger creation yet.
The original wizard remains samples; do not describe it as database-backed creation.

Admin-only POST `resource=settings` saves eight explicit business keys, with time/rate
validation and transaction-scoped advisory lock so no unique-key schema assumption is
needed. Sending, credential and auth-bypass keys cannot be changed. Original database
Settings page forwards POST only for app staff; backend validates independently.
No automatic database migration or data write was executed against hosted databases.
Real staff login/end-to-end verification remains deferred at user request.

## Original wizard database connection (limited)

`/preview/database-book` requires a real app staff session, loads tenant-scoped
services/drivers/vehicles and uses original components. Lexical wizard transport
maps only explicit API resources; unsupported operations return 501. Existing
passenger search is limited to 25 matches; no full passenger list is downloaded.
Vehicle reads require owning employee in tenant and reject cross-tenant assignment
relationships. No vehicle samples substitute for missing hosted records.

Transactional one-way save validates selected services, quantity/price bounds,
passenger/driver ownership, writes appointment service lines, and sets summed totals
and TEST-id booking number. This is fare subtotal only, not complete live pricing:
no taxes/CC fees, actual payments, tours/weddings/recurring/round-trip support yet.
Populated unsupported fields fail closed, not silently lost. New passenger creation,
client updates and clone-trip reads remain disconnected; choose an existing passenger.
Save Without Sending and no payment method/specific vehicle are required. The known
empty vehicles table blocks the original mandatory vehicle-category step until real
test vehicle records are safely supplied. No app-auth bypass is extended.

Isolated PostgreSQL tests exercise service totals/line persistence and rejected
cross-tenant services; hosted saves and full original wizard flow are unverified.
Do not call this operational parity or a ready-to-cut-over migration.

## Owner-approved bounded booking review

Dedicated `preview/bounded-booking-review` Preview only, expires November 3 2026
03:14 UTC. Vercel Authentication is the external identity/access gate; no app cookie
or general admin session is created. Exact branch/environment/time checks permit
tenant 1 reads plus POST lookup/wizard-booking ONLY. Other write resources explicitly
reject during this window, even for that review context. Same-origin, body limits,
existing passenger/service/tenant validation and no-message/no-payment checks remain.
No reset-email dependency. On expiry ordinary app sign-in applies again.

Protection must remain enabled on project/generated deployment URLs; no share links,
automation bypass, browser tool bypass or production-domain alias is created. This
permits Vercel-authorized viewers, not verified application staff; owner approved this
limited test-booking access. Stored test bookings remain after expiration. Do not
promote/merge this temporary design into production. Settings/assignment mutations
are not enabled through this review capability. No hosted database writes executed
by the agent; actual data rendering/full booking still requires owner verification.

## Passenger-create integration correction

Original wizard new-passenger POST now maps to an explicit tenant-scoped test API,
with validated text/email, transaction advisory lock, duplicate email/phone matching
within tenant and a returned ID. Duplicate records return existing_id for original
wizard handling; ambiguous matches reject. Notification preference forced to none.
Failed creation stops submission immediately. Existing customer profile PATCH remains
unimplemented and is skipped in this database test rather than falsely logging success.

Passenger creation and booking are separate transactions, matching original flow:
a created passenger may remain if the subsequent booking is rejected. No claim of
all-or-nothing passenger+booking is made. Isolated SQL test creates new passenger,
then saves full ordinary booking/service lines, then retrieves the passenger through
tenant-bound join. Hosted/browser save still unverified. Same exact branch/expiry
(03:14 UTC November 3) and Vercel gate; new passenger resource explicitly added only
to the bounded capability. No production changes or real notifications.

## Specific vehicle booking support

Database wizard driver-vehicle lookup is now mapped to selected-field server reads.
A specific vehicle save must exist in tenant-bound vehicle reads and, when driver
selected, belong to that driver's ownership/assignment relationship. Cross-tenant
vehicle relationships reject. Chosen vehicle_id persists in booking transaction.
No vehicle-creation/edit/delete endpoint is enabled. Isolated integration test covers
new passenger, full ordinary payload, specific vehicle/service-line save and joined
retrieval; invalid foreign-tenant vehicle rejects. Hosted vehicle choice not verified.

Owner reported hosted booking success November 3 around 03:12 UTC; request logs show
two 201 API responses followed by 200 database-dashboard GET, consistent with passenger
and booking creation. Specific saved values/refresh persistence not independently
inspected. Original temporary booking capability expires 03:14 UTC unchanged; no
password-free extension performed. Remaining hosted verification requires authorized
app sign-in or a separately approved bounded review window. Production unchanged.

## Database-only trip navigation

Database dashboard now renders an explicit database link map, not the sample map.
All Trips anchors to database-trips, booking and assignments/settings stay on database
routes, unknown links remain inert. Booking search binds tenant and literal substring
search (booking number/passenger), optional TEST-% filter and bounded pagination.
Newest-created ordering surfaces fresh tests regardless of pickup date. Each result
links to the original assignment timeline with America/Chicago pickup-date query.
Timeline initializes from date parameter on database route only. Other table actions
remain disabled; temporary capability does not add assignment write rights. User must
not interpret a date-specific read view as an enabled assignment write workflow.

## Temporary TEST-only assignment capability

Owner requested coherent database workflow. Existing Vercel-protected, exact-branch
window through November 3 05:20 UTC now explicitly permits assignment PATCH for TEST-%
booking numbers in tenant 1 only. SQL predicates enforce test-only and tenant scope;
non-test imported bookings remain protected even if UI drag attempted. Same-origin,
driver membership/activity validation and unchanged start_time remain enforced.
No rescheduling, setting edits or external messages granted through temporary review.
PGlite regression covers TEST assignment/unassignment, non-test and cross-tenant
rejection, wrong-tenant drivers and unchanged pickup time. No actual hosted write
verification performed by agent. User must test refresh persistence on TEST booking.
