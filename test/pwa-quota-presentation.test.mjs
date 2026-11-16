import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { quotaPresentation } from "../src/pwa/quota-presentation.mjs";

test("PWA shows only measured Netlify quota values as available", () => {
  const view = quotaPresentation({
    status: "available",
    allowed: true,
    source: "netlify_official_team_usage",
    credits_used: 120,
    credits_limit: 300,
    measured_at: "2026-11-16T12:00:00.000Z",
  });
  assert.equal(view.tone, "allowed");
  assert.match(view.message, /120 von 300 Credits/);
  assert.match(view.message, /2026-11-16 12:00:00 UTC/);
});

test("unknown and malformed quota values keep cloud job admission visibly closed", () => {
  const view = quotaPresentation({
    status: "available",
    allowed: true,
    source: "unavailable",
    credits_used: 120,
    credits_limit: 300,
    measured_at: "not-a-date",
    reason: "do-not-show-this-provider-text",
  });
  assert.equal(view.tone, "unknown");
  assert.match(view.message, /Cloud-Aufträge pausiert/);
  assert.doesNotMatch(view.message, /120|300|do-not-show-this-provider-text/);
});

test("quota reasons are mapped to fixed safe messages and unknown values are not echoed", () => {
  const stale = quotaPresentation({ status: "unknown", allowed: false, reason: "authoritative_usage_is_stale" });
  const hostile = quotaPresentation({ status: "unknown", allowed: false, reason: "<img src=x onerror=alert(1)>" });
  assert.match(stale.message, /veraltet/);
  assert.match(hostile.message, /nicht verifiziert/);
  assert.doesNotMatch(hostile.message, /<img|onerror/);
});

test("local ungated mode is labeled explicitly and does not claim cloud quota verification", () => {
  const view = quotaPresentation({ status: "not_gated", allowed: true });
  assert.equal(view.tone, "local");
  assert.match(view.message, /kein Cloud-Kontingent wird überwacht/);
  assert.match(view.message, /keine Cloud-Freigabe/);
});

test("PWA exposes quota status to assistive technology and precaches the presentation module", async () => {
  const html = await readFile(new URL("../src/pwa/index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../src/pwa/app.js", import.meta.url), "utf8");
  const worker = await readFile(new URL("../src/pwa/sw.js", import.meta.url), "utf8");
  assert.match(html, /id="job-admission"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(app, /renderQuotaAdmission\(snapshot\.job_admission\)/);
  assert.match(app, /error\.payload\?\.job_admission/);
  assert.match(worker, /prompthub-static-v8/);
  assert.match(worker, /"quota-presentation\.mjs"/);
});
