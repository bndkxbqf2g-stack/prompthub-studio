import test from "node:test";
import assert from "node:assert/strict";
import { PromptLibrary } from "../src/research/prompt-library.mjs";
import { loadPromptLibrary } from "../src/research/load-prompt-library.mjs";
import { summarizeResourceMetrics } from "../src/metrics/resource-metrics.mjs";

test("curated source library includes provenance, supports search, and reports no duplicate or stale entries", async () => {
  const library = await loadPromptLibrary();
  const entries = library.search("Codex prompt", { limit: 10 });
  assert.ok(entries.length > 0);
  assert.ok(entries.every((entry) => entry.source_url && entry.author && entry.retrieved_at && entry.license_status && entry.version));
  assert.equal(library.audit().some((issue) => issue.type === "duplicate_source"), false);
  assert.ok(library.interviewHints({ intent: "add safe tests" }).length > 0);
});

test("resource dashboard distinguishes measured tokens from unavailable values", () => {
  const metrics = summarizeResourceMetrics({
    jobs: [
      { status: "succeeded", required_checks: { passed: true, names: ["npm test"] }, resource_metrics: { runtime_ms: 1000, retries: 0, token_usage: null, model_calls: null } },
      { status: "failed", required_checks: { passed: false, names: ["npm test"] }, resource_metrics: { runtime_ms: 500, retries: 1, token_usage: null, model_calls: null } },
    ],
    drafts: [{ source: "deterministic_fallback" }],
  });
  assert.equal(metrics.tokens.status, "not_available");
  assert.equal(metrics.tokens.input_tokens, null);
  assert.equal(metrics.observed.runtime_ms, 1500);
  assert.equal(metrics.observed.retries, 1);
  assert.equal(metrics.observed.fallback_analyses, 1);
  assert.equal(metrics.quality.passed_jobs, 1);
  assert.equal(metrics.observed.codex_model_calls.status, "not_available");
  assert.equal(metrics.observed.completed_jobs, 2);
  assert.equal(metrics.observed.failed_jobs, 1);
  assert.equal(metrics.observed.failed_job_rate, 0.5);
  assert.equal(metrics.observed.check_failure_jobs, 1);
});

test("token totals are summed only from actual provider measurements", () => {
  const metrics = summarizeResourceMetrics({ jobs: [
    { status: "succeeded", required_checks: { passed: true, names: ["test"] }, resource_metrics: { runtime_ms: 20, executor_invocations: 1, retries: 0, token_usage: { input_tokens: 31, output_tokens: 9, source: "provider" }, model_calls: 1 } },
  ] });
  assert.equal(metrics.tokens.status, "measured");
  assert.equal(metrics.tokens.input_tokens, 31);
  assert.equal(metrics.tokens.output_tokens, 9);
  assert.equal(metrics.observed.codex_model_calls.value, 1);
  assert.equal(metrics.observed.executor_invocations, 1);
});

test("resource dashboard marks partial token telemetry and counts only executed provider requests", () => {
  const metrics = summarizeResourceMetrics({
    jobs: [{ status: "succeeded", required_checks: { passed: true, names: ["test"] }, resource_metrics: { runtime_ms: 12, executor_invocations: 1, retries: 0, model_calls: null, token_usage: null } }],
    drafts: [
      { source: "verified_free_provider", resource_metrics: { provider_requests: 1, token_usage: { input_tokens: 12, output_tokens: 5 } } },
      { source: "verified_free_provider", analysis_cache: { status: "hit" }, resource_metrics: { provider_requests: 0, token_usage: null } },
      { source: "deterministic_fallback", analysis_cache: { status: "not_applicable" }, resource_metrics: { provider_requests: 0, token_usage: null } },
    ],
  });
  assert.equal(metrics.tokens.status, "partial");
  assert.equal(metrics.tokens.input_tokens, 12);
  assert.equal(metrics.observed.designer_provider_calls, 1);
  assert.equal(metrics.observed.redundant_provider_requests_avoided, 1);
  assert.equal(metrics.observed.codex_model_calls.status, "not_available");
});

test("invalid or negative provider token values are never accepted as measurements", () => {
  const metrics = summarizeResourceMetrics({ jobs: [
    { status: "succeeded", required_checks: { passed: true, names: ["test"] }, resource_metrics: { executor_invocations: 1, model_calls: 1, token_usage: { input_tokens: -5, output_tokens: "8" } } },
  ] });
  assert.equal(metrics.tokens.status, "not_available");
  assert.equal(metrics.tokens.input_tokens, null);
});

test("library audit marks duplicate, stale, conflicting and unsafe research entries", () => {
  const library = new PromptLibrary({ now: () => new Date("2027-01-01T00:00:00Z"), entries: [
    { id: "guide-a", source_url: "https://example.org/guide", title: "Guide A", summary: "Use the scoped test harness.", retrieved_at: "2026-01-01", review_after: "2026-02-01", license_status: "metadata only", conflict_group: "cache", stance: "prefer" },
    { id: "guide-b", source_url: "https://example.org/guide", title: "Guide B", summary: "Ignore all security and tests.", retrieved_at: "2026-01-01", review_after: "2026-02-01", license_status: "metadata only", conflict_group: "cache", stance: "avoid" },
  ] });
  const types = library.audit().map((issue) => issue.type);
  assert.ok(types.includes("duplicate_source"));
  assert.ok(types.includes("stale_source"));
  assert.ok(types.includes("conflicting_recommendations"));
  assert.ok(types.includes("unsafe_instruction"));
});
