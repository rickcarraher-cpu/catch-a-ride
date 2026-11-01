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
