import { test } from 'node:test';
import assert from 'node:assert/strict';
import { temporaryReviewEnabled, REVIEW_CONFIG } from '../app/lib/temporary-review.server';
const valid = {VERCEL_ENV:'preview', VERCEL_GIT_COMMIT_REF:REVIEW_CONFIG.branch};
const before=Date.parse(REVIEW_CONFIG.expiresAt)-1000;
test('temporary review is limited to exact Preview branch and expiry',()=>{
 assert.equal(temporaryReviewEnabled(valid,before),true);
 for(const env of [{},{...valid,VERCEL_ENV:'production'},{...valid,VERCEL_ENV:'development'},{...valid,VERCEL_GIT_COMMIT_REF:'main'},{...valid,VERCEL_GIT_COMMIT_REF:undefined}]) assert.equal(temporaryReviewEnabled(env,before),false);
 assert.equal(temporaryReviewEnabled(valid,Date.parse(REVIEW_CONFIG.expiresAt)),false);
 assert.equal(temporaryReviewEnabled(valid,Date.parse(REVIEW_CONFIG.expiresAt)+1),false);
 assert.equal(temporaryReviewEnabled(valid,NaN),false);
});
