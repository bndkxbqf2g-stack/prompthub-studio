import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequestHandler } from "../src/api/handler.mjs";
import { readConfig } from "../src/config.mjs";
import { strategyApprovalGate, strategyStatusLabel } from "../src/pwa/strategy-presentation.mjs";

const PROJECT = "owner/app";
const APPROVED_AT = "2026-11-15T12:00:00.000Z";

function criticalStrategy(overrides = {}) {
  return {
    id: "strategy_123",
    project_id: PROJECT,
    proposed_by: "strategy-author",
    critical: true,
    status: "awaiting_approval",
    evidence: {
      schema_version: 1,
      project_id: PROJECT,
      source: "github_pull_request_and_actions_api",
      critical: true,
      verified: true,
      pull_request_number: 12,
      pull_request_author: "change-author",
      head_sha: "a".repeat(40),
      workflow_run_id: 34,
      check_name: "test",
      check_completed_at: APPROVED_AT,
      run_completed_at: APPROVED_AT,
      file_list_complete: true,
      file_list_valid: true,
      changed_file_count: 2,
      review_list_complete: true,
      independent_reviewers: [{ login: "reviewer", reviewed_at: APPROVED_AT }],
    },
    ...overrides,
  };
}

test("PWA offers critical adoption only for complete project-scoped GitHub evidence", () => {
  assert.equal(strategyApprovalGate(criticalStrategy(), "github", PROJECT).allowed, true);
  assert.equal(strategyApprovalGate(criticalStrategy(), "local", PROJECT).allowed, false);
  assert.equal(strategyApprovalGate(criticalStrategy(), "unknown", PROJECT).allowed, false);
  assert.equal(strategyApprovalGate(criticalStrategy(), "github", "owner/other").allowed, false);
});

test("PWA hides approval affordance for incomplete evidence and non-independent reviews", () => {
  const incomplete = criticalStrategy();
  incomplete.evidence.file_list_complete = false;
  assert.match(strategyApprovalGate(incomplete, "github", PROJECT).reason, /Dateien/);

  const proposerReview = criticalStrategy();
  proposerReview.evidence.independent_reviewers = [{ login: "strategy-author", reviewed_at: APPROVED_AT }];
  assert.match(strategyApprovalGate(proposerReview, "github", PROJECT).reason, /unabhängiger APPROVED-Review/);

  const authorReview = criticalStrategy();
  authorReview.evidence.independent_reviewers = [{ login: "change-author", reviewed_at: APPROVED_AT }];
  assert.match(strategyApprovalGate(authorReview, "github", PROJECT).reason, /unabhängiger APPROVED-Review/);
});

test("PWA labels CI evidence without claiming strategy effectiveness", async () => {
  assert.equal(strategyStatusLabel({ critical: false, status: "adopted" }), "CI-Nachweis gespeichert");
  assert.equal(strategyStatusLabel({ critical: true, status: "awaiting_approval" }), "Kritisch · Freigabe ausstehend");
  const html = await readFile(new URL("../src/pwa/index.html", import.meta.url), "utf8");
  assert.match(html, /belegt keine kausale Wirksamkeit/);
  assert.match(html, /id="strategy-panel"/);
  assert.match(html, /id="strategy-form"/);
});

test("PWA submits evidence references only and precaches the strategy module", async () => {
  const app = await readFile(new URL("../src/pwa/app.js", import.meta.url), "utf8");
  const worker = await readFile(new URL("../src/pwa/sw.js", import.meta.url), "utf8");
  assert.match(app, /strategyApprovalGate, strategyStatusLabel/);
  assert.match(app, /provider\s*\}\s*=\s*await request\("\/api\/me"\)/);
  assert.match(app, /\/api\/projects\/\$\{encodeURIComponent\(state\.selectedProject\)\}\/strategies/);
  assert.match(app, /ADOPT STRATEGY \$\{strategy\.id\}/);
  assert.match(app, /body: JSON\.stringify\(\{ confirmation: expected \}\)/);
  assert.doesNotMatch(app, /authenticatedGithub:\s*true|approvedBy\s*:/);
  assert.match(worker, /prompthub-static-v7/);
  assert.match(worker, /"strategy-presentation\.mjs"/);
  assert.match(worker, /"quota-presentation\.mjs"/);
});

test("project job and incident views ignore stale responses after switching projects", async () => {
  const app = await readFile(new URL("../src/pwa/app.js", import.meta.url), "utf8");
  const jobsLoader = app.slice(app.indexOf("async function loadJobs()"), app.indexOf("\nasync function decide", app.indexOf("async function loadJobs()")));
  const incidentsLoader = app.slice(app.indexOf("async function loadIncidents()"), app.indexOf("\nasync function loadStrategies", app.indexOf("async function loadIncidents()")));
  assert.match(jobsLoader, /\/api\/jobs\?project=\$\{encodeURIComponent\(projectId\)\}/);
  assert.match(jobsLoader, /if \(state\.selectedProject !== projectId\) return;/);
  assert.match(incidentsLoader, /if \(state\.selectedProject !== projectId\) return;/);
  assert.match(app, /failedLabel\.htmlFor = failed\.id/);
  assert.match(app, /correctedLabel\.htmlFor = corrected\.id/);
});

test("/api/me reports the authenticated GitHub provider without exposing its token", async () => {
  const handler = createRequestHandler({
    config: readConfig({ NODE_ENV: "test", PROMPTHUB_MODE: "memory", AUTH_MODE: "local" }),
    controlPlane: { async listJobs() { return []; } },
    auth: { async getSession() { return { user: { login: "approved-user" }, provider: "github", token: "server-only-token" }; } },
  });
  const response = await handler(new Request("https://prompthub.example/api/me"));
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.provider, "github");
  assert.equal(payload.local, false);
  assert.equal(payload.user.login, "approved-user");
  assert.equal("token" in payload, false);
  assert.doesNotMatch(JSON.stringify(payload), /server-only-token/);
});
