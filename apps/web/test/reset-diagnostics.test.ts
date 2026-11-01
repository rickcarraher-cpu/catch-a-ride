import { test } from 'node:test';
import assert from 'node:assert/strict';
import { logResetStage, sendResetEmail } from '../app/lib/reset-diagnostics.server';
test('diagnostics distinguish failures without leaking provider or request secrets', async () => {
  const oldFetch = globalThis.fetch; const oldLog = console.error;
  const oldUrl = process.env.DATABASE_URL; const oldSecret = process.env.AUTH_SECRET;
  const logs: unknown[][] = [];
  console.error = (...args) => { logs.push(args); };
  process.env.DATABASE_URL = 'test-only'; process.env.AUTH_SECRET = 'test-secret-at-least-thirty-two-characters';
  try {
    logResetStage('database', { code: '42P01', message: 'PRIVATE_SQL' });
    logResetStage('configuration', { message: 'PRIVATE_KEY' });
    globalThis.fetch = async () => new Response('PRIVATE_PROVIDER_BODY', { status: 403 });
    await assert.rejects(sendResetEmail('PRIVATE_KEY', 'PRIVATE_EMAIL', 'PRIVATE_LINK'));
    globalThis.fetch = async () => { throw new Error('PRIVATE_TRANSPORT'); };
    await assert.rejects(sendResetEmail('PRIVATE_KEY', 'PRIVATE_EMAIL', 'PRIVATE_LINK'));
    assert.deepEqual(logs.map(l => l[1]), [
      { stage: 'database', reason: 'missing_database_table' }, { stage: 'configuration' },
      { stage: 'email_response', status: 403 }, { stage: 'email_transport' },
    ]);
    assert.ok(!JSON.stringify(logs).includes('PRIVATE'));
    globalThis.fetch = async () => new Response('{}', { status: 200 });
    await sendResetEmail('PRIVATE_KEY', 'PRIVATE_EMAIL', 'PRIVATE_LINK');
    assert.equal(logs.length, 4);
  } finally {
    globalThis.fetch = oldFetch; console.error = oldLog;
    if (oldUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = oldUrl;
    if (oldSecret === undefined) delete process.env.AUTH_SECRET; else process.env.AUTH_SECRET = oldSecret;
  }
});
