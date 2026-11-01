import { test } from "node:test";
import assert from "node:assert/strict";
import { renderRecoveredDashboard, requireDashboardPreview } from "../app/lib/recovered-dashboard.server";

test("recovered layout renders without connecting any service and has no active controls", () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error("Preview must not call a service"); };
  try {
    const html = renderRecoveredDashboard();
    for (const text of ["Catch A Ride", "Process Payments", "Assign Drivers", "All Trips", "Manage Drivers"]) {
      assert.ok(html.includes(text), `Missing original dashboard label: ${text}`);
    }
    assert.doesNotMatch(html, /<script\b|\bhref=|<iframe\b|<form\b/i);
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
