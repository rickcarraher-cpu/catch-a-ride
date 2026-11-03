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
 assert.ok(databaseDashboardLink('/payments')?.startsWith('/preview/feature?'));
 assert.equal(databaseDashboardLink('//outside.example'),null);
});
