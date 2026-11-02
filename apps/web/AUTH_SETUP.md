# Database sign-in setup

The React Router application now verifies email/password credentials from Postgres,
issues a signed HttpOnly cookie containing a random session token, stores only its
SHA-256 digest in Postgres, and checks the database before returning dashboard data.
Logout revokes the session. Sessions expire after seven days. Cross-origin POSTs are
rejected and each normalized email is limited to ten sign-in attempts per 15 minutes.
There is no development login bypass and no public signup: accounts must already
exist or be provisioned by a database administrator.

## Vercel project settings

For the `catcharide` project:

- Root Directory: `apps/web` (already configured).
- Framework Preset: React Router (already configured).
- Build Command and Output Directory: leave at framework defaults.
- Install Command: leave at default; commit and use the included Bun lockfile.
- No extra rewrites, custom server entrypoint, or Auth.js trust-host setting is needed.

In the project's **Environment Variables** settings add/verify these **server-only** variables:

| Name | Purpose |
| --- | --- |
| `DATABASE_URL` | Your Postgres provider's pooled connection URL, with its required TLS options. For example, copy the pooled URL directly from Neon. Never disable TLS certificate verification. |
| `AUTH_SECRET` | A cryptographically random secret, at least 32 characters. Generate it locally (for example `openssl rand -base64 48`) and paste directly into Vercel's secret input; do not commit it or send it in chat. |

Both names already exist in Production; their values have not been inspected or
validated. They were absent from Preview at implementation time. Configure Preview
with a **separate test database** and its own secret before testing the PR. Use a
local database and local-only secret for Development. Select the intended environments,
save, and create a new deployment; existing deployments do not pick up changed variables.

Reference: https://vercel.com/docs/environment-variables/managing-environment-variables

`AUTH_TRUST_HOST`, ADP, Square and Create integration variables are not used by this
login implementation. Existing unrelated variables can stay unchanged.

## Database migration and first account

Do this for each database before testing login. These are deliberate database
writes; never run them against the wrong environment or as an automatic build step.

1. From `apps/web`, run `bun install --frozen-lockfile`.
2. Copy `.env.example` to `.env.local`. Enter the database URL and secret locally
   in that ignored file, not in a shell command, Git, a PR, or chat.
3. Back up an existing database. Run `bun --env-file=.env.local run db:migrate`.
   The migration creates missing tables only; it does not drop, clear, or replace
   existing users/accounts. Existing tables must have the exported scaffold columns:
   `auth_users(id, email, name)` and
   `auth_accounts("userId", provider, password)` with Argon2 password hashes.
   If an old schema differs, reconcile it explicitly rather than replacing it.
4. Existing credential accounts can sign in immediately. For a new database, run
   `bun --env-file=.env.local run db:create-user`. It asks for email, display name,
   and a hidden password twice. It refuses to overwrite an existing account.
   Do not invent a default password or enable public registration for staff access.
5. Deploy the PR as a preview, open `/account/signin`, and verify correct password →
   dashboard, incorrect password → generic error, Sign Out → sign-in, and direct
   `/dashboard` access after sign-out → sign-in.
6. After preview verification, merge to deploy Production with its own database.

New tables `app_login_sessions` and `app_login_attempts` coexist with any legacy
Auth.js sessions. Old Auth.js cookies do not log users into this implementation.
Schedule routine database housekeeping appropriate to your provider:
`DELETE FROM app_login_sessions WHERE expires_at < now();`
and `DELETE FROM app_login_attempts WHERE started_at < now() - interval '1 day';`.
Do not cache personalized responses at a CDN; route loaders send `Cache-Control: no-store`.

## Security note

A `.env` containing the key name `ANYTHING_PROJECT_TOKEN` was previously tracked.
This PR removes that file and ignores local env files. If its value was a live
credential, rotate/revoke it with its issuer: removal does not erase Git history.

## Checks

Run `bun run test:auth`, `bun run typecheck`, and `bun run build`.
The authentication tests use an isolated in-memory PostgreSQL engine; they never
connect to production or read deployment credentials. Live database/TLS connectivity
and an actual preview account still need the manual checks above.

## Preview-only email password reset (not enabled in Production)

The reset routes are gated to `VERCEL_ENV=preview`. They use `RESEND_KEY`, the
verified sender `noreply@catcharide.us`, and Vercel's `VERCEL_URL` for the exact
preview's reset link. No request-supplied host or redirect URL is used. Sending
emails uses your Resend account and can incur usage. Configure the secret using
Vercel's protected input; never put its value in chat, Git, or command arguments.

After explicit database-change approval, apply `db/002-password-reset.sql` ONLY to
the confirmed development database. This creates `app_password_resets` and its
expiry index; it does not change existing accounts or passwords. The app does not
run migrations automatically. An approved Preview deployment is also required.

Request a reset through `/account/forgot-password`. The response is deliberately
the same for unknown accounts, throttling and email errors. Check server logs for
a generic delivery/configuration failure when no email arrives. A random 256-bit
reset token expires after 15 minutes, is stored only as a SHA-256 digest, and is
consumed atomically with the credential update and session revocation. Each account
has at most one active reset link; requesting another invalidates the prior link. Passwords
must be 12–1024 characters and are Argon2id-hashed. Requests are throttled to three
per email and twenty globally per 15 minutes. These counters use the existing
login-attempts table with a separate `reset:` namespace.

The email link carries its token in the URL fragment (not sent in GET requests or
Referer headers); the browser removes the fragment after reading it into memory.
GET never consumes a token, so email scanners cannot reset the password. The token
and password are submitted only in a same-origin POST body. Do not enable request
body logging or analytics capture on these pages. Reloading the reset page clears
the in-memory token; reopen the complete email link instead. If Vercel deployment
protection requires authentication, sign into Vercel first and reopen the link.
A successful reset revokes this app's sessions and clears the sign-in throttle;
it does not change employee/driver portal passwords or legacy platform sessions.

Housekeeping: delete expired rows from `app_password_resets` on your normal
scheduled database maintenance. Live email delivery and the full browser reset
flow require verification after the approved migration and Preview deployment.
