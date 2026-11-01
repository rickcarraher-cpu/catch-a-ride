# Migration readiness checkpoint — 2026-11-01

## Goal and boundaries

Mirror the original application screens and workflows, not a redesigned practice
app. The recovered UI is evidence of source recovery, not operational readiness.
Keep production, domains, payment processing and customer communications unchanged
until data isolation, security and end-to-end behavior are verified.

## Verified state

- Original dispatch booking components are recovered in PR #4. The sample adapter
  never calls the network; its settings/rates and stored bookings are examples.
- The active route configuration registers authentication, a minimal protected
  dashboard, and isolated sample pages. No original business API is registered.
- Preview variable names DATABASE_URL, AUTH_SECRET and RESEND_KEY exist as Secrets.
  Existence does not prove correctness, schema completeness or database isolation.
- The team storage listing returned no managed resources. An externally configured
  database may still exist. No conclusion about provider ownership can be drawn.
- Preview runtime logs for /account/signin in the 01:40–03:20 UTC window showed an
  uncaught PostgreSQL connection-termination error and process exit at 01:57 UTC.
  This is not evidence that the user's earlier invalid-password result had the
  same cause. No successful real-account login is verified.

## Historical source findings — not proof about the running Anything site

Reviewed the October 27 source snapshot (`b4d543b`) in Git history:

1. `utils/tenant-resolver.js` accepts a tenant-override cookie without checking an
   administrative entitlement and falls back to tenant 1 for absent sessions,
   missing employees and errors. Replace with server-derived, fail-closed tenant
   membership; no client cookie may select an unauthorized tenant.
2. `employees/route.js` POST has no initial requireAuth guard and stores driver
   passwords as plaintext, with a fixed fallback password. Do not restore it as-is.
   Require authorized staff role, approved tenant, CSRF/origin checks and proper
   credential hashing/provisioning. Existing stored credential format is unverified.
3. `appointments/route.js` POST lacks the GET handler's initial auth guard and has
   multiple hardcoded tenant-1 operations. GET also updates completed status during
   retrieval. Replace with explicit authorized writes and read-only reads.
4. Booking creation can create payment links and send confirmations unless flags
   disable them. Tests alone must never depend on callers remembering those flags:
   enforce test-mode integration isolation on the server before restoring APIs.
5. Active pg Pool initialization has no idle-client error listener; the observed
   process crash is consistent with an unhandled idle connection error. Add a
   sanitized listener and focused test, then verify reconnect behavior on Preview.
   Do not call this a fix for credential mismatch or an unknown database state.

The old source is not deployed by the sample routes. These findings do not establish
whether the current live platform has the same issues. Do not probe production or
copy plaintext credentials into source, logs or documents.

## Required development reconnection sequence

- [ ] Confirm exact provider/project/database branch behind Preview DATABASE_URL;
      verify it is separate from the live database before running writes/migrations.
- [ ] Obtain supported read-only schema access and inspect required table/column
      metadata, never passwords or customer rows unnecessarily.
- [ ] Confirm a dedicated test account and its staff/driver role. Successful login,
      wrong-password rejection, logout/session revocation must pass on Preview.
- [ ] Repair tenant and role authorization centrally and test cross-tenant access,
      forged override cookies, inactive employees and missing membership.
- [ ] Restore original Trips UI and explicit field-limited read endpoints behind
      the authenticated tenant context. No SELECT * employee/credential exposure.
- [ ] Add validated booking CRUD and driver assignment transactions with server-
      enforced messaging/payment isolation. Verify persistence and reload.
- [ ] Reconnect integrations one at a time in provider test modes and prove no
      customer messages or real charges before running end-to-end test bookings.
- [ ] Match original screens at representative desktop/mobile sizes; explicitly
      list remaining behavior/layout differences. Preserve original components.
- [ ] Separately approve and back up the independent production database/data-copy
      step; validate counts, relationships and application behavior before cutover.
- [ ] Define post-copy change freeze/sync and rollback data reconciliation. Merely
      pointing the domain back does NOT preserve new writes on the new database.
- [ ] Obtain explicit cutover approval after verified gates; preserve a tested
      rollback target. Never promote the sample preview as the operational app.

## Current blocker

No managed database resource was discoverable and the stored connection is a Secret.
Database identity/isolation, schema and a valid test account remain unverified.
Do not bypass login or enable the historical APIs to work around these gates.
Provider-side project/branch metadata and a supported connection/test-account path
are needed before safe real-data reconnection. Do not request credential values in
chat or publish them in a PR.

This checkpoint performs no migrations, data changes, production settings changes,
payment calls or email/SMS sends. It is not a claim of overnight/background execution.
