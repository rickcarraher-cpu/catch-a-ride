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
