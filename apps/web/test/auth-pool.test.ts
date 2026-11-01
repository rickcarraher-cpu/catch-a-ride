import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getAuth, getDatabase } from '../app/lib/auth.server';

test('auth pool handles repeated idle errors without throwing or logging exception contents', async () => {
  const oldUrl = process.env.DATABASE_URL;
  const oldSecret = process.env.AUTH_SECRET;
  const oldLog = console.error;
  const logs: unknown[][] = [];
  // Dummy configuration only: no pool.query/connect call is made in this test.
  process.env.DATABASE_URL = 'postgresql://example.invalid/test';
  process.env.AUTH_SECRET = 'test-only-signing-secret-of-at-least-32-characters';
  console.error = (...args: unknown[]) => { logs.push(args); };
  const auth = getAuth();
  const pool = getDatabase();
  try {
    assert.equal(pool.totalCount, 0);
    for (const code of ['57P01', 'ECONNRESET', 'PRIVATE_CODE']) {
      assert.doesNotThrow(() => pool.emit('error', Object.assign(new Error('PRIVATE_URL_AND_PASSWORD'), { code, detail: 'PRIVATE_DETAIL' })));
    }
    assert.equal(getAuth(), auth);
    assert.equal(getDatabase(), pool);
    assert.equal(pool.totalCount, 0);
    assert.deepEqual(logs, [
      ['Authentication unavailable', { reason: 'database_connection_terminated' }],
      ['Authentication unavailable', { reason: 'database_connection_reset' }],
      ['Authentication unavailable', { reason: 'unclassified_authentication_failure' }],
    ]);
    assert.ok(!JSON.stringify(logs).includes('PRIVATE'));
  } finally {
    console.error = oldLog;
    if (oldUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = oldUrl;
    if (oldSecret === undefined) delete process.env.AUTH_SECRET; else process.env.AUTH_SECRET = oldSecret;
    await pool.end();
  }
});
