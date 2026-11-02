// Never log arbitrary error messages, stack traces, SQL, connection URLs or request data.
const reasons: Record<string, string> = {
  "42P01": "missing_database_table",
  "42703": "missing_database_column",
  "42501": "database_permission_denied",
  "28P01": "database_password_rejected",
  "28000": "database_authorization_failed",
  "3D000": "database_not_found",
  "53300": "database_connection_limit",
  ECONNREFUSED: "database_connection_refused",
  ENOTFOUND: "database_hostname_not_found",
  EAI_AGAIN: "database_dns_temporarily_unavailable",
  ETIMEDOUT: "database_connection_timed_out",
  ECONNRESET: "database_connection_reset",
  CERT_HAS_EXPIRED: "database_tls_certificate_expired",
  DEPTH_ZERO_SELF_SIGNED_CERT: "database_tls_certificate_untrusted",
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: "database_tls_certificate_untrusted",
  ERR_TLS_CERT_ALTNAME_INVALID: "database_tls_hostname_mismatch",
};
export function authFailureReason(error: unknown): string {
  if (!process.env.DATABASE_URL) return "missing_database_url";
  if (!process.env.AUTH_SECRET) return "missing_auth_secret";
  if (process.env.AUTH_SECRET.length < 32) return "auth_secret_too_short";
  // Only allowlisted codes are emitted. Never serialize the original exception.
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") {
    return Object.hasOwn(reasons, error.code) ? reasons[error.code] : "unclassified_authentication_failure";
  }
  return "unclassified_authentication_failure";
}
export function logAuthFailure(error: unknown) {
  console.error("Authentication unavailable", { reason: authFailureReason(error) });
}
