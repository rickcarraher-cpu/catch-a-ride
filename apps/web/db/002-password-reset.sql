-- Apply explicitly to the confirmed development database only. Never during a build.
CREATE TABLE IF NOT EXISTS public.app_password_resets (
  token_hash text PRIMARY KEY,
  user_id text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS app_password_resets_expiry ON public.app_password_resets (expires_at);
