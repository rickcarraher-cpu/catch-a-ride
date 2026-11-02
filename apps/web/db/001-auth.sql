-- Compatible with the exported auth_users/auth_accounts naming. Existing tables/data are preserved.
BEGIN;
CREATE TABLE IF NOT EXISTS auth_users (
  id bigserial PRIMARY KEY,
  name text,
  email text NOT NULL UNIQUE,
  "emailVerified" timestamptz,
  image text
);
-- Preserve an existing integer, UUID or text user ID type when creating accounts.
DO $$
DECLARE user_id_type text;
BEGIN
  IF to_regclass('auth_accounts') IS NULL THEN
    SELECT format_type(atttypid, atttypmod) INTO user_id_type
      FROM pg_attribute WHERE attrelid = 'auth_users'::regclass AND attname = 'id';
    EXECUTE format('CREATE TABLE auth_accounts (
      id bigserial PRIMARY KEY,
      "userId" %s NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
      type text NOT NULL, provider text NOT NULL,
      "providerAccountId" text NOT NULL, password text,
      UNIQUE (provider, "providerAccountId")
    )', user_id_type);
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS app_login_sessions (
  token_hash text PRIMARY KEY,
  user_id text NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS app_login_sessions_expiry ON app_login_sessions (expires_at);
CREATE TABLE IF NOT EXISTS app_login_attempts (
  key text PRIMARY KEY,
  attempts integer NOT NULL,
  started_at timestamptz NOT NULL
);
COMMIT;
