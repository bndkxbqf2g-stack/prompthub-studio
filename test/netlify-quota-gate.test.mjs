import test from "node:test";
import assert from "node:assert/strict";
import { LocalAuth } from "../src/auth/github-oauth.mjs";
import { createRequestHandler } from "../src/api/handler.mjs";
import { readConfig } from "../src/config.mjs";
import { createNetlifyQuotaGate, evaluateNetlifyQuota } from "../src/hosting/netlify-quota-gate.mjs";

const now = Date.parse("2026-11-16T12:00:00.000Z");
const freshUsage = (credits_used) => ({
  plan: "free",
  hard_limit: true,
  auto_recharge_enabled: false,
  source: "netlify_official_team_usage",
  credits_used,
  credits_limit: 300,
  measured_at: new Date(now).toISOString(),
});

test("Netlify admission opens only with fresh authoritative Free usage below 75%", () => {
  assert.equal(evaluateNetlifyQuota(freshUsage(224), { now }).allowed, true);
  assert.equal(evaluateNetlifyQuota(freshUsage(225), { now }).status, "paused");
  assert.equal(evaluateNetlifyQuota(freshUsage(299), { now }).allowed, false);
});

test("unknown, stale, or non-Free usage keeps admission closed", async () => {
  assert.equal(evaluateNetlifyQuota(null, { now }).status, "unknown");
  assert.equal(evaluateNetlifyQuota({ ...freshUsage(10), measured_at: "2026-11-16T11:44:00.000Z" }, { now }).allowed, false);
  assert.equal(evaluateNetlifyQuota({ ...freshUsage(10), plan: "unknown" }, { now }).status, "unknown");
  assert.equal(evaluateNetlifyQuota({ ...freshUsage(10), auto_recharge_enabled: true }, { now }).status, "unknown");
  assert.equal(evaluateNetlifyQuota({ ...freshUsage(10), hard_limit: false }, { now }).status, "unknown");
  assert.equal((await createNetlifyQuotaGate().status()).allowed, false);
  assert.equal((await createNetlifyQuotaGate({ usageProvider: async () => { throw new Error("private provider detail"); } }).status()).status, "unknown");
});

test("Netlify API job creation, job approval, and prompt handoff fail closed when usage is unknown", async () => {
  const config = readConfig({ NODE_ENV: "test", PROMPTHUB_MODE: "memory", AUTH_MODE: "local", PROMPTHUB_ALLOWED_PROJECTS: "demo" });
  let created = 0;
  let approved = 0;
  let handedOff = 0;
  const controlPlane = {
    async listJobs() { return []; },
    async createJob() { created += 1; return { id: "job-1", status: "queued" }; },
    async approveJob() { approved += 1; return { id: "job-1", status: "queued" }; },
  };
  const handler = createRequestHandler({
    config,
    controlPlane,
    auth: new LocalAuth(),
    projectService: {},
    promptDesigner: {
      async approve() { handedOff += 1; return { id: "job-2" }; },
    },
    jobAdmissionGate: createNetlifyQuotaGate(),
  });

  const health = await handler(new Request("https://hub.example/healthz"));
  assert.equal((await health.json()).job_admission.status, "unknown");

  const create = await handler(new Request("https://hub.example/api/jobs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt: "task", project: "demo" }) }));
  assert.equal(create.status, 503);
  assert.equal((await create.json()).error, "job_admission_paused");

  const approve = await handler(new Request("https://hub.example/api/jobs/job-1/approve", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ decision: "approve" }) }));
  assert.equal(approve.status, 503);

  const handoff = await handler(new Request("https://hub.example/api/designer/drafts/draft-1/approve", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project: "demo", confirmation: "approve" }) }));
  assert.equal(handoff.status, 503);
  assert.deepEqual({ created, approved, handedOff }, { created: 0, approved: 0, handedOff: 0 });
});
