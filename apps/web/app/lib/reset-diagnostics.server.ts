import { authFailureReason } from './auth-diagnostics.server';
export type ResetStage = 'configuration' | 'database' | 'email_transport' | 'email_response';
const transportCodes: Record<string, string> = {
  ENOTFOUND: 'dns_not_found', EAI_AGAIN: 'dns_temporary_failure',
  ECONNREFUSED: 'connection_refused', ECONNRESET: 'connection_reset',
  ETIMEDOUT: 'connection_timeout', UND_ERR_CONNECT_TIMEOUT: 'connection_timeout',
  CERT_HAS_EXPIRED: 'tls_certificate_expired',
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: 'tls_certificate_untrusted',
  DEPTH_ZERO_SELF_SIGNED_CERT: 'tls_certificate_untrusted',
  ERR_TLS_CERT_ALTNAME_INVALID: 'tls_hostname_mismatch',
};
export function transportReason(error: unknown): string {
  if (!error || typeof error !== 'object') return 'unclassified_transport_failure';
  if ('name' in error && error.name === 'TimeoutError') return 'request_timeout';
  if ('name' in error && error.name === 'AbortError') return 'request_aborted';
  const code = 'code' in error ? error.code : undefined;
  if (typeof code === 'string' && Object.hasOwn(transportCodes, code)) return transportCodes[code];
  const cause = 'cause' in error ? error.cause : undefined;
  if (cause && typeof cause === 'object' && 'code' in cause && typeof cause.code === 'string' && Object.hasOwn(transportCodes, cause.code)) return transportCodes[cause.code];
  return 'unclassified_transport_failure';
}
export function logResetStage(stage: ResetStage, error?: unknown, status?: number) {
  // Never serialize exceptions, provider bodies, email addresses or reset URLs.
  const details: { stage: ResetStage; reason?: string; status?: number } = { stage };
  if (stage === 'email_transport') details.reason = transportReason(error);

  if (stage === 'database') details.reason = authFailureReason(error);
  if (stage === 'email_response' && Number.isInteger(status) && status! >= 100 && status! <= 599) details.status = status;
  console.error('Preview password reset failure', details);
}
export async function sendResetEmail(key: string, email: string, link: string) {
  let headers: Headers;
  try { headers = new Headers({ Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }); }
  catch { logResetStage('configuration'); throw new Error('Reset email configuration invalid'); }
  let response: Response;
  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST', signal: AbortSignal.timeout(10_000),
      headers,
      body: JSON.stringify({ from: 'Catch A Ride <noreply@catcharide.us>', to: [email],
        subject: 'Reset your Catch A Ride TEST account password',
        text: `This resets your development/test account only, not your live account.\n\nOpen this link within 15 minutes:\n${link}\n\nIf you did not request this, ignore this email.` }),
    });
  } catch (error) { logResetStage('email_transport', error); throw new Error('Reset delivery unavailable'); }
  if (!response.ok) { logResetStage('email_response', undefined, response.status); throw new Error('Reset delivery unavailable'); }
}
