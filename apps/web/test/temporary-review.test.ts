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

import {bookingReviewEnabled,bookingReviewResource,BOOKING_REVIEW_EXPIRY} from '../app/lib/booking-review.server';
test('booking review exact branch expiry and resource boundaries',()=>{
 const env={VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'preview/bounded-booking-review'};
 const before=Date.parse(BOOKING_REVIEW_EXPIRY)-1;
 assert.equal(bookingReviewEnabled(env,before),true);
 assert.equal(bookingReviewEnabled({...env,VERCEL_ENV:'production'},before),false);
 assert.equal(bookingReviewEnabled({...env,VERCEL_GIT_COMMIT_REF:'main'},before),false);
 assert.equal(bookingReviewEnabled(env,Date.parse(BOOKING_REVIEW_EXPIRY)),false);
 assert.equal(bookingReviewResource('wizard-booking'),true);assert.equal(bookingReviewResource('passenger'),true);assert.equal(bookingReviewResource('assignment'),true);
 for(const resource of ['settings','booking',null])assert.equal(bookingReviewResource(resource),false);
});
