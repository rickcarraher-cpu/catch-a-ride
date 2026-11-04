import { test } from "node:test";
import assert from "node:assert/strict";
import { renderRecoveredDashboard, requireDashboardPreview, sampleDashboardLink, databaseDashboardLink } from "../app/lib/recovered-dashboard.server";

test("recovered layout renders without connecting any service and has no active controls", () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error("Preview must not call a service"); };
  try {
    const html = renderRecoveredDashboard();
    for (const text of ["Catch A Ride", "Process Payments", "Assign Drivers", "All Trips", "Manage Drivers"]) {
      assert.ok(html.includes(text), `Missing original dashboard label: ${text}`);
    }
    assert.doesNotMatch(html, /<script\b|<iframe\b|<form\b/i);
    for (const link of html.matchAll(/href="([^"]*)"/g)) assert.ok(["/preview/book", "#sample-trips", "/preview/settings", "/preview/assignments"].includes(link[1]));
    for (const button of html.matchAll(/<button\b[^>]*>/g)) assert.match(button[0], /\bdisabled=/);
    for (const input of html.matchAll(/<input\b[^>]*>/g)) assert.match(input[0], /\bdisabled=/);
    assert.doesNotMatch(html, /Signing in|Signed in as/);
  } finally { globalThis.fetch = originalFetch; }
});

test("dashboard viewing route fails closed outside Preview", () => {
  const old = process.env.VERCEL_ENV;
  try {
    for (const environment of [undefined, "production", "development"]) {
      if (environment === undefined) delete process.env.VERCEL_ENV;
      else process.env.VERCEL_ENV = environment;
      assert.throws(requireDashboardPreview, (error: unknown) => error instanceof Response && error.status === 404);
    }
    process.env.VERCEL_ENV = "preview";
    assert.doesNotThrow(requireDashboardPreview);
  } finally {
    if (old === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = old;
  }
});

test("only explicitly supported booking links are enabled", () => {
  assert.equal(sampleDashboardLink('/trips?new=true&dispatch=true'), '/preview/book');
  assert.equal(sampleDashboardLink('/trips'), '#sample-trips');
  for (const href of ['/payments', '/drivers', '/trips?new=true&tour=true', 'https://external.example', 'javascript:alert(1)']) assert.equal(sampleDashboardLink(href), null);
});

test('database dashboard cannot route enabled links to sample pages',()=>{
 assert.equal(databaseDashboardLink('/trips'),'/preview/database#database-trips');
 assert.equal(databaseDashboardLink('/trips?new=true&dispatch=true'),'/preview/database-book');
 assert.equal(databaseDashboardLink('/schedule-timeline'),'/preview/database-assignments');
 const html=renderRecoveredDashboard('database');assert.doesNotMatch(html,/href="\/preview\/(book|settings|assignments)"|#sample-trips/);
});

test('review orders and online booking use real test destinations; unfinished links disclose status',()=>{
 assert.equal(databaseDashboardLink('/trips?status=needs_review'),'/preview/database?status=needs_review#database-trips');
 assert.equal(databaseDashboardLink('/book/catch-a-ride'),'/preview/online-book');
 assert.equal(databaseDashboardLink('/trips?new=true&tour=true'),'/preview/deferred?feature=tour-creation');
 assert.equal(databaseDashboardLink('//outside.example'),null);
});

test('daily and print schedule dashboard links use actual protected database routes',()=>{
 assert.equal(databaseDashboardLink('/schedule'),'/preview/daily-schedule');
 assert.equal(databaseDashboardLink('/print-schedule'),'/preview/print-schedule');
});

test('both original calendars are real test-database destinations',()=>{
 assert.equal(databaseDashboardLink('/calendar'),'/preview/calendar');
 assert.equal(databaseDashboardLink('/calendar-glance'),'/preview/calendar-glance');
});

test('three report destinations route to protected database-backed screens',()=>{
 for(const report of ['all-trips','by-driver','unpaid-trips'])assert.equal(databaseDashboardLink('/reports/'+report),'/preview/reports/'+report);
});

test('availability and history links use connected protected pages',()=>{
 assert.equal(databaseDashboardLink('/blocked-times'),'/preview/blocked-times');
 assert.equal(databaseDashboardLink('/dashboard/admin/manage-availability'),'/preview/manage-availability');
 assert.equal(databaseDashboardLink('/communication-log'),'/preview/communication-log');
});

test('expense and daily review controls route to real protected screens',()=>{
 for(const page of ['expenses','five-pm-reminder','receipts-needed'])assert.equal(databaseDashboardLink('/'+page),'/preview/'+page);
 const html=renderRecoveredDashboard('database');assert.ok(html.includes('href="/preview/receipts-needed"'));
});

test('payment report and recurring review links are connected',()=>{
 for(const name of ['weekly-payments','payments-by-method'])assert.equal(databaseDashboardLink('/reports/'+name),'/preview/reports/'+name);
 assert.equal(databaseDashboardLink('/recurring'),'/preview/recurring');
});

test('partner tour and original wedding list destinations are connected',()=>{
 assert.equal(databaseDashboardLink('/third-party-trips'),'/preview/advanced/third-party');
 assert.equal(databaseDashboardLink('/tours'),'/preview/advanced/tours');
 assert.equal(databaseDashboardLink('/weddings'),'/preview/advanced/weddings');
});

test('driver message history has its own protected original screen',()=>{
 assert.equal(databaseDashboardLink('/driver-messages'),'/preview/driver-messages');
});

test('ledger and Close Up checklist have real protected routes',()=>{
 assert.equal(databaseDashboardLink('/payments'),'/preview/payments');
 assert.ok(renderRecoveredDashboard('database').includes('href="/preview/close-up"'));
});

test('payroll and both Weddings2 routes reflect resolved owner decisions',()=>{
 assert.equal(databaseDashboardLink('/timesheet-report'),'/preview/timesheet-report');
 assert.equal(databaseDashboardLink('/weddings-2'),'/preview/weddings-2');
 assert.equal(databaseDashboardLink('/weddings-2/review'),'/preview/weddings-2-review');
});

import {readFileSync} from 'node:fs';
test('every rendered database dashboard anchor targets a registered route, not generic placeholder/sample',()=>{
 const routes=readFileSync(new URL('../app/routes.ts',import.meta.url),'utf8');
 const patterns=[...routes.matchAll(/route\("([^\"]+)"/g)].map(m=>new RegExp('^/'+m[1].split('/').map(x=>x.startsWith(':')?'[^/]+':x).join('/')+'$'));
 const html=renderRecoveredDashboard('database');let count=0;
 for(const match of html.matchAll(/href="([^"]*)"/g)){
  const path=match[1].split(/[?#]/)[0];assert(patterns.some(p=>p.test(path)),`Unregistered dashboard target: ${match[1]}`);
  assert(!['/preview/feature','/preview/book','/preview/settings','/preview/assignments','/preview/dashboard','/preview/workspace'].includes(path));count++;
 }
 assert(count>=40);assert.doesNotMatch(html,/<button\b|aria-disabled="true"|unfinished-action/);
 assert.match(html,/href="\/preview\/database-messages\?unread=true"/);
});
test('obsolete placeholders resolve current known destinations with no recursion/external redirect',()=>{
 assert.equal(databaseDashboardLink('/preview/feature?destination=%2Fmessages%3Funread%3Dtrue'),'/preview/database-messages?unread=true');
 assert.equal(databaseDashboardLink('/preview/feature?destination=%2Fprint-schedule'),'/preview/print-schedule');
 assert.equal(databaseDashboardLink('/preview/feature?destination=%2Fpreview%2Ffeature'),null);
 assert.equal(databaseDashboardLink('/preview/feature?destination=https%3A%2F%2Fevil.test'),null);
 assert.equal(databaseDashboardLink('/weddings/add-trip'),'/preview/deferred?feature=wedding-trips');
});
test('obsolete sample dashboard now redirects to database dashboard',async()=>{
 const old=process.env.VERCEL_ENV;process.env.VERCEL_ENV='preview';try{const {loader}=await import('../app/preview/dashboard');const response=loader();assert.equal(response.status,302);assert.equal(response.headers.get('Location'),'/preview/database');}finally{if(old===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=old;}
});
