import { authFailureReason } from './auth-diagnostics.server';
export type ResetStage = 'configuration' | 'database' | 'email_transport' | 'email_response';
export function logResetStage(stage: ResetStage, error?: unknown, status?: number) {
  // Never serialize exceptions, provider bodies, email addresses or reset URLs.
  const details: { stage: ResetStage; reason?: string; status?: number } = { stage };
  if (stage === 'database') details.reason = authFailureReason(error);
  if (stage === 'email_response' && Number.isInteger(status) && status! >= 100 && status! <= 599) details.status = status;
  console.error('Preview password reset failure', details);
}
export async function sendResetEmail(key: string, email: string, link: string) {
  let response: Response;
  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST', signal: AbortSignal.timeout(10_000),
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'Catch A Ride <noreply@catcharide.us>', to: [email],
        subject: 'Reset your Catch A Ride TEST account password',
        text: `This resets your development/test account only, not your live account.\n\nOpen this link within 15 minutes:\n${link}\n\nIf you did not request this, ignore this email.` }),
    });
  } catch { logResetStage('email_transport'); throw new Error('Reset delivery unavailable'); }
  if (!response.ok) { logResetStage('email_response', undefined, response.status); throw new Error('Reset delivery unavailable'); }
}
