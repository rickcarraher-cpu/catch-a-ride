// Dedicated Preview only. Vercel Authentication is the external access gate.
// This never creates an app session, grants staff privileges, or allows writes.
export const REVIEW_CONFIG = {
  enabled: true,
  branch: 'preview/temporary-read-review',
  expiresAt: '2026-11-02T19:28:00Z',
} as const;
export function temporaryReviewEnabled(env: Record<string, string | undefined> = process.env, now = Date.now()) {
  return REVIEW_CONFIG.enabled && env.VERCEL_ENV === 'preview'
    && env.VERCEL_GIT_COMMIT_REF === REVIEW_CONFIG.branch
    && Number.isFinite(now) && now < Date.parse(REVIEW_CONFIG.expiresAt);
}
