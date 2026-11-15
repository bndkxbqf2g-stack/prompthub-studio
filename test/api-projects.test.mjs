import test from "node:test";
import assert from "node:assert/strict";
import { readConfig } from "../src/config.mjs";
import { LocalAuth } from "../src/auth/github-oauth.mjs";
import { createControlPlane } from "../src/control/index.mjs";
import { createHttpServer } from "../src/api/server.mjs";
import { createRequestHandler } from "../src/api/handler.mjs";
import { MemoryProjectStore } from "../src/projects/project-store.mjs";
import { ProjectService } from "../src/projects/project-service.mjs";
import { PromptDesigner } from "../src/designer/prompt-designer.mjs";
import { PromptLibrary } from "../src/research/prompt-library.mjs";
import { ErrorLearningEngine } from "../src/knowledge/error-learning.mjs";

class FakeRepositoryClient {
  constructor() {
    this.writes = 0;
  }
  async getRepository(id) { return { full_name: id, html_url: `https://github.com/${id}`, private: true, default_branch: "main", permissions: { pull: true, push: true } }; }
  async getContent(_repo, path) { return path === "AGENTS.md" ? { content: "Run the relevant tests.", sha: "sha" } : null; }
  async listContents() { return []; }
  async listIssues() { return []; }
  async listWorkflowRuns() { return { workflow_runs: [] }; }
}

async function withConfiguredServer(callback) {
  const config = readConfig({ NODE_ENV: "test", PROMPTHUB_MODE: "memory", AUTH_MODE: "local", PROMPTHUB_ALLOWED_PROJECTS: "demo", CODEX_ARGS_JSON: '["exec","--","$PROMPTHUB_PROMPT"]' });
  const controlPlane = createControlPlane(config);
  const client = new FakeRepositoryClient();
  const projectService = new ProjectService({ store: new MemoryProjectStore(), client, controlPlane, controlRepository: "owner/control" });
  const promptLibrary = new PromptLibrary({ entries: [{ id: "sample-source", title: "Sample", source_url: "https://example.org", categories: ["testing"], tags: [], summary: "Use verifiable tests.", quality_estimate: {}, verified_outcomes: [] }] });
  const errorLearning = new ErrorLearningEngine({ projectService });
  const promptDesigner = new PromptDesigner({ projectService, controlPlane, promptLibrary, errorLearning });
  const server = createHttpServer({ config, controlPlane, auth: new LocalAuth(), projectService, promptDesigner, promptLibrary, errorLearning, logger: { error() {} } });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try { return await callback(`http://127.0.0.1:${server.address().port}`, client, { projectService, controlPlane, errorLearning }); }
  finally { await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
}

test("/api/me exposes only the provider needed to render gated PWA actions", async () => {
  await withConfiguredServer(async (base) => {
    const response = await fetch(`${base}/api/me`);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.provider, "local");
    assert.equal(payload.local, true);
    assert.deepEqual(payload.user, { login: "local-user", id: "local", name: "Local development session" });
    assert.equal("token" in payload, false);
  });
});

test("metrics marks the GitHub issue-list boundary as potentially incomplete", async () => {
  const config = { ...readConfig({ NODE_ENV: "test", PROMPTHUB_MODE: "memory", AUTH_MODE: "local" }), mode: "github" };
  const controlPlane = { async listJobs() { return Array.from({ length: 100 }, (_, index) => ({ id: `job-${index}`, project: "owner/app", status: "queued" })); } };
  const handler = createRequestHandler({ config, controlPlane, auth: new LocalAuth() });
  const response = await handler(new Request("https://prompthub.example/api/metrics"));
  const snapshot = await response.json();
  assert.equal(snapshot.coverage.listed_jobs, 100);
  assert.equal(snapshot.coverage.job_list_limit, 100);
  assert.equal(snapshot.coverage.job_list_may_be_limited, true);
});

test("GET /api/jobs filters results to the requested project", async () => {
  const jobs = [
    { id: "job-app", project: "owner/app", status: "queued" },
    { id: "job-other", project: "owner/other", status: "succeeded" },
  ];
  const handler = createRequestHandler({
    config: readConfig({ NODE_ENV: "test", PROMPTHUB_MODE: "memory", AUTH_MODE: "local" }),
    controlPlane: { async listJobs() { return jobs; } },
    auth: new LocalAuth(),
  });
  const response = await handler(new Request("https://prompthub.example/api/jobs?project=owner%2Fapp"));
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).jobs.map((job) => job.id), ["job-app"]);
});

test("authenticated incident API stores user symptoms and unconfirmed hypotheses only in the selected project", async () => {
  await withConfiguredServer(async (base, _client, { projectService }) => {
    const project = await projectService.connect("owner/app", "local-user");
    await projectService.connect("owner/other", "local-user");
    const reportResponse = await fetch(`${base}/api/projects/${encodeURIComponent(project.id)}/incidents`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ summary: "The checkout view fails after refresh", components: ["src/checkout/view.mjs"] }),
    });
    assert.equal(reportResponse.status, 201);
    const report = (await reportResponse.json()).incident;
    assert.equal(report.cause_status, "unknown");
    assert.equal(report.history[0].actor, "local-user");

    const hypothesisResponse = await fetch(`${base}/api/projects/${encodeURIComponent(project.id)}/incidents/${encodeURIComponent(report.id)}/hypotheses`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ summary: "A stale response may be cached" }),
    });
    assert.equal(hypothesisResponse.status, 201);
    assert.equal((await hypothesisResponse.json()).incident.cause_status, "hypothesis");
    const own = await (await fetch(`${base}/api/projects/${encodeURIComponent(project.id)}/incidents`)).json();
    const otherResponse = await fetch(`${base}/api/projects/owner%2Fother/incidents`);
    const other = await otherResponse.json();
    assert.equal(otherResponse.status, 200, JSON.stringify(other));
    assert.equal(own.incidents.length, 1);
    assert.equal(other.incidents.length, 0);
    const dashboard = await (await fetch(`${base}/api/metrics`)).json();
    assert.equal(dashboard.metrics.errors.observed_incidents, 1);
    assert.equal(dashboard.metrics.errors.open_hypotheses, 1);
    assert.equal(dashboard.metrics.errors.user_reports, 1);
    assert.equal(dashboard.metrics.errors.confirmed_regressions, 0);
    assert.equal(dashboard.metrics.ci_diagnostic.root_cause_confirmed, false);
    const invalidCause = await fetch(`${base}/api/projects/${encodeURIComponent(project.id)}/incidents/${encodeURIComponent(report.id)}/confirm`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ hypothesisId: "hypothesis_missing", failedJobId: "job_missing", correctedJobId: "job_other", confirmation: "yes" }),
    });
    assert.equal(invalidCause.status, 400);
  });
});

test("authenticated PWA flow connects read-only, requires approved prompt handoff, removes and reconnects without repository deletion", async () => {
  await withConfiguredServer(async (base, client) => {
    const connected = await fetch(`${base}/api/projects`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ repository: "owner/app" }) });
    assert.equal(connected.status, 201);
    const project = (await connected.json()).project;
    assert.equal(project.status, "connected");

    const bypass = await fetch(`${base}/api/jobs`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project: project.id, prompt: "Skip approval", risk: "low" }) });
    assert.equal(bypass.status, 403);

    const draftResponse = await fetch(`${base}/api/designer/drafts`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project: project.id, intent: "Only update the documentation for a small feature. Add tests." }) });
    assert.equal(draftResponse.status, 201);
    const draft = (await draftResponse.json()).draft;
    const metricsResponse = await fetch(`${base}/api/metrics`);
    assert.equal(metricsResponse.status, 200);
    const metricsSnapshot = await metricsResponse.json();
    assert.equal(metricsSnapshot.cache_source, "live");
    assert.equal(metricsSnapshot.coverage.connected_projects, 1);
    assert.equal(metricsSnapshot.coverage.retained_prompt_drafts, 1);
    assert.equal(metricsSnapshot.coverage.prompt_draft_retention_per_project, 50);
    assert.equal(metricsSnapshot.coverage.job_list_limit, null);
    const metrics = metricsSnapshot.metrics;
    assert.equal(metrics.errors.source, "verified_project_incident_history");
    assert.equal(metrics.errors.observed_incidents, 0);
    assert.equal(metrics.ci_diagnostic.root_cause_confirmed, false);
    assert.equal(metrics.tokens.status, "not_available");
    assert.equal(metrics.tokens.input_tokens, null);
    assert.equal(metrics.observed.designer_provider_calls, 0);
    assert.equal(metrics.observed.fallback_analyses, 1);
    const cachedSnapshot = await (await fetch(`${base}/api/metrics`)).json();
    assert.equal(cachedSnapshot.cache_source, "short_cache");
    const started = await fetch(`${base}/api/designer/drafts/${draft.id}/start`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project: project.id }) });
    assert.equal((await started.json()).draft.stage, "consolidated");
    const generated = await fetch(`${base}/api/designer/drafts/${draft.id}/generate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project: project.id }) });
    assert.equal((await generated.json()).draft.versions[0].qa.passed, true);
    const approved = await fetch(`${base}/api/designer/drafts/${draft.id}/approve`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project: project.id, version: 1, confirm: true }) });
    assert.equal(approved.status, 200);
    const job = (await approved.json()).job;
    assert.equal(job.project, project.id);
    assert.equal(job.status, "queued");

    const refused = await fetch(`${base}/api/projects/${encodeURIComponent(project.id)}/remove`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirmation: true }) });
    assert.equal(refused.status, 400);
    const removed = await fetch(`${base}/api/projects/${encodeURIComponent(project.id)}/remove`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirmation: `REMOVE ${project.id}` }) });
    assert.equal(removed.status, 200);
    assert.equal((await removed.json()).removed, true);
    assert.equal((await (await fetch(`${base}/api/jobs`)).json()).jobs[0].status, "paused");

    const reconnected = await fetch(`${base}/api/projects/${encodeURIComponent(project.id)}/reconnect`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    assert.equal((await reconnected.json()).project.status, "connected");

    const review1 = await fetch(`${base}/api/prompt-library/sample-source/review`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ favorite: true, note: "Useful test checklist.", correction: "Keep examples project-specific." }) });
    assert.equal((await review1.json()).review.version, 1);
    const review2 = await fetch(`${base}/api/prompt-library/sample-source/review`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ favorite: true, note: "Updated note.", correction: "Keep examples project-specific." }) });
    assert.equal((await review2.json()).review.version, 2);
    const reviews = await (await fetch(`${base}/api/prompt-library/reviews`)).json();
    assert.equal(reviews.reviews[0].history.length, 2);

    await fetch(`${base}/api/projects/${encodeURIComponent(project.id)}/remove`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirmation: `REMOVE ${project.id}` }) });
    const deleteData = await fetch(`${base}/api/projects/${encodeURIComponent(project.id)}/data`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirmation: `DELETE DATA ${project.id}` }) });
    assert.equal(deleteData.status, 200);
    assert.equal(client.writes, 0);
  });
});
