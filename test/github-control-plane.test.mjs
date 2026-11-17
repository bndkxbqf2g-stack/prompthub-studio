import test from "node:test";
import assert from "node:assert/strict";
import { GitHubControlPlane } from "../src/control/github-control-plane.mjs";
import { GitHubApiError } from "../src/control/github-client.mjs";
import { validateJobInput } from "../src/domain/job.mjs";
import { decodeBase64Url, encodeBase64Url } from "../src/security/web-crypto.mjs";

class FakeGitHubClient {
  constructor() {
    this.labels = [];
    this.issues = [];
    this.comments = new Map();
    this.nextIssue = 1;
    this.leaseFile = { content: JSON.stringify({ version: 2, next_generation: 1, leases: [] }), sha: "lease-0" };
    this.leaseRevision = 0;
    this.files = new Map();
    this.fileRevision = 0;
    this.failNextLeaseWrite = false;
    this.failNextJobStateWrite = false;
    this.failNextIssueUpdate = false;
    this.forceContentsLimit = false;
    this.failTreeListing = false;
    this.treeDirectoryCalls = 0;
    this.readRefs = [];
    this.missingJobDirectory = false;
  }

  async listLabels() { return this.labels.map((name) => ({ name })); }
  async createLabel(_repo, { name }) { if (!this.labels.includes(name)) this.labels.push(name); }
  async createIssue(_repo, payload) {
    const issue = { number: this.nextIssue++, html_url: `https://github.example/issues/${this.nextIssue}`, title: payload.title, body: payload.body, labels: payload.labels.map((name) => ({ name })), created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    this.issues.push(issue);
    this.comments.set(issue.number, []);
    return issue;
  }
  async listIssues() { return this.issues; }
  async listIssueComments(_repo, issueNumber) { return this.comments.get(issueNumber) ?? []; }
  async createIssueComment(_repo, issueNumber, body) { this.comments.get(issueNumber).push({ body }); }
  async request(path) {
    const match = /\/issues\/(\d+)$/.exec(path);
    return this.issues.find((issue) => issue.number === Number(match[1]));
  }
  async updateIssue(_repo, issueNumber, payload) {
    if (this.failNextIssueUpdate) {
      this.failNextIssueUpdate = false;
      throw new Error("simulated issue projection failure");
    }
    const issue = this.issues.find((item) => item.number === issueNumber);
    issue.labels = payload.labels.map((name) => ({ name }));
    issue.updated_at = new Date().toISOString();
    return issue;
  }
  async getContent(_repository, path, ref) {
    this.readRefs.push(ref);
    if (path === ".prompthub/active-jobs.json") return this.leaseFile ? { ...this.leaseFile, path } : null;
    const file = this.files.get(path);
    return file ? { ...file, path } : null;
  }
  async listContents(_repository, path) {
    if (path !== ".prompthub/jobs") return [];
    if (this.missingJobDirectory) throw new GitHubApiError(404, "directory missing");
    if (this.forceContentsLimit) {
      return Array.from({ length: 1000 }, (_, index) => ({ type: "file", name: `job_placeholder-${index}.json`, path: `.prompthub/jobs/job_placeholder-${index}.json` }));
    }
    return [...this.files.keys()]
      .filter((filePath) => filePath.startsWith(".prompthub/jobs/"))
      .map((filePath) => ({ type: "file", name: filePath.split("/").at(-1), path: filePath }));
  }
  async listTreeDirectory(_repository, path) {
    this.treeDirectoryCalls += 1;
    if (this.failTreeListing) throw new Error("GitHub tree listing is incomplete; refusing to operate");
    const entries = [...this.files.keys()]
      .filter((filePath) => filePath.startsWith(`${path}/`))
      .map((filePath) => ({ type: "file", name: filePath.split("/").at(-1), path: filePath }));
    return { ref: "tree-snapshot-sha", entries };
  }
  async putContent(_repository, path, { content, sha }) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    if (path === ".prompthub/active-jobs.json" && this.failNextLeaseWrite) {
      this.failNextLeaseWrite = false;
      throw new Error("simulated lease write failure");
    }
    if (path.startsWith(".prompthub/jobs/") && this.failNextJobStateWrite) {
      this.failNextJobStateWrite = false;
      throw new Error("simulated job-state creation failure");
    }
    const current = path === ".prompthub/active-jobs.json" ? this.leaseFile : this.files.get(path);
    if ((sha ?? null) !== (current?.sha ?? null)) throw new GitHubApiError(409, "conflict");
    if (path === ".prompthub/active-jobs.json") {
      this.leaseRevision += 1;
      this.leaseFile = { content, sha: `lease-${this.leaseRevision}` };
    } else {
      this.fileRevision += 1;
      this.files.set(path, { content, sha: `file-${this.fileRevision}` });
    }
  }
}

test("GitHub control plane stores job metadata and append-only events", async () => {
  const client = new FakeGitHubClient();
  const control = new GitHubControlPlane({ client, repository: "owner/private-control", branch: "main", leasePath: ".prompthub/active-jobs.json", leaseTtlMs: 120000, maxActiveJobs: 2 });
  const input = validateJobInput({ prompt: "Keep this prompt out of the issue title", project: "demo" }, { allowedProjects: ["demo"] });
  const created = await control.createJob(input);
  assert.equal(created.status, "queued");
  assert.equal(client.issues[0].title.includes(input.prompt), false);
  assert.equal(client.issues[0].body.includes(input.prompt), false);
  const loaded = await control.getJob(created.id);
  assert.equal(loaded.status, "queued");
  assert.equal(loaded.events[0].type, "created");
  assert.equal(loaded.prompt_preview, input.prompt);
});

test("a missing lease ledger cannot be replaced during job-state initialization", async () => {
  const client = new FakeGitHubClient();
  client.leaseFile = null;
  const control = new GitHubControlPlane({ client, repository: "owner/private-control", branch: "main", leasePath: ".prompthub/active-jobs.json", leaseTtlMs: 120000, maxActiveJobs: 2 });

  await assert.rejects(
    () => control.createJob(validateJobInput({ prompt: "do not initialize over missing durable state", project: "demo" }, { allowedProjects: ["demo"] })),
    /lease ledger is missing/,
  );
  assert.equal(client.issues.length, 0);
});

test("recovery imports an issue safely after first canonical state creation fails", async () => {
  const client = new FakeGitHubClient();
  const control = new GitHubControlPlane({ client, repository: "owner/private-control", branch: "main", leasePath: ".prompthub/active-jobs.json", leaseTtlMs: 120000, maxActiveJobs: 2 });
  client.failNextJobStateWrite = true;

  await assert.rejects(
    () => control.createJob(validateJobInput({ prompt: "recover partial job initialization", project: "demo" }, { allowedProjects: ["demo"] }), { id: "job_partial-init" }),
    /simulated job-state creation failure/,
  );
  assert.equal(client.issues.length, 1);

  await control.recoverStaleJobs();
  const recovered = await control.getJob("job_partial-init");
  assert.equal(recovered.status, "stale");
  assert.equal(recovered.events.some((event) => event.type === "stale"), true);
});

test("GitHub control plane rejects a completion from a runner without the active lease", async () => {
  const client = new FakeGitHubClient();
  const control = new GitHubControlPlane({ client, repository: "owner/private-control", branch: "main", leasePath: ".prompthub/active-jobs.json", leaseTtlMs: 120000, maxActiveJobs: 2 });
  const created = await control.createJob(validateJobInput({ prompt: "run safely", project: "demo" }, { allowedProjects: ["demo"] }));
  assert.ok(await control.claimJob(created.id, "runner-a"));

  await assert.rejects(() => control.completeJob(created.id, "runner-b", "failed"), /active lease not found/);
  assert.equal((await control.getJob(created.id)).status, "running");
});

test("GitHub control plane rejects a completion after the runner lease expires", async () => {
  const client = new FakeGitHubClient();
  let now = new Date("2026-01-01T00:00:00.000Z");
  const control = new GitHubControlPlane({ client, repository: "owner/private-control", branch: "main", leasePath: ".prompthub/active-jobs.json", leaseTtlMs: 1000, maxActiveJobs: 2, now: () => now });
  const created = await control.createJob(validateJobInput({ prompt: "finish only with a live lease", project: "demo" }, { allowedProjects: ["demo"] }));
  assert.ok(await control.claimJob(created.id, "runner-a"));
  now = new Date("2026-01-01T00:00:01.000Z");

  await assert.rejects(() => control.completeJob(created.id, "runner-a", "failed"), /active lease not found/);
  assert.equal((await control.getJob(created.id)).status, "running");
});

test("GitHub control plane allows the active lease owner to complete after passing checks", async () => {
  const client = new FakeGitHubClient();
  const control = new GitHubControlPlane({ client, repository: "owner/private-control", branch: "main", leasePath: ".prompthub/active-jobs.json", leaseTtlMs: 120000, maxActiveJobs: 2 });
  const created = await control.createJob(validateJobInput({ prompt: "finish after checks", project: "demo" }, { allowedProjects: ["demo"] }));
  assert.ok(await control.claimJob(created.id, "runner-a"));

  const completed = await control.completeJob(created.id, "runner-a", "succeeded", { requiredChecks: { passed: true, names: ["test"] } });
  assert.equal(completed.status, "succeeded");
  assert.equal(JSON.parse(client.leaseFile.content).leases.length, 0);
});

test("concurrent claims from duplicate runner processes grant only one lease", async () => {
  const client = new FakeGitHubClient();
  const controlA = new GitHubControlPlane({ client, repository: "owner/private-control", branch: "main", leasePath: ".prompthub/active-jobs.json", leaseTtlMs: 120000, maxActiveJobs: 2 });
  const controlB = new GitHubControlPlane({ client, repository: "owner/private-control", branch: "main", leasePath: ".prompthub/active-jobs.json", leaseTtlMs: 120000, maxActiveJobs: 2 });
  const created = await controlA.createJob(validateJobInput({ prompt: "run once", project: "demo" }, { allowedProjects: ["demo"] }));

  const claims = await Promise.all([controlA.claimJob(created.id, "runner-a"), controlB.claimJob(created.id, "runner-b")]);
  assert.equal(claims.filter(Boolean).length, 1);
  assert.equal(JSON.parse(client.leaseFile.content).leases.length, 1);
});

test("pause and claim races leave either a paused job without lease or a running job with lease", async () => {
  const client = new FakeGitHubClient();
  const controlA = new GitHubControlPlane({ client, repository: "owner/private-control", branch: "main", leasePath: ".prompthub/active-jobs.json", leaseTtlMs: 120000, maxActiveJobs: 2 });
  const controlB = new GitHubControlPlane({ client, repository: "owner/private-control", branch: "main", leasePath: ".prompthub/active-jobs.json", leaseTtlMs: 120000, maxActiveJobs: 2 });
  const created = await controlA.createJob(validateJobInput({ prompt: "race pause and claim", project: "demo" }, { allowedProjects: ["demo"] }));

  const outcomes = await Promise.allSettled([
    controlA.claimJob(created.id, "runner-a"),
    controlB.pauseJob(created.id, "owner", "Pause request"),
  ]);
  const final = await controlA.getJob(created.id);
  const leases = JSON.parse(client.leaseFile?.content ?? "{\"leases\":[]}").leases;
  if (final.status === "paused") assert.equal(leases.some((lease) => lease.job_id === created.id), false);
  else {
    assert.equal(final.status, "running");
    assert.equal(leases.filter((lease) => lease.job_id === created.id).length, 1);
  }
  const claimOutcome = outcomes[0];
  const pauseOutcome = outcomes[1];
  assert.equal(claimOutcome.status === "fulfilled" && Boolean(claimOutcome.value), final.status === "running");
  assert.equal(pauseOutcome.status === "fulfilled", final.status === "paused");
});

test("expired runner generation cannot complete after recovery, resume and a new claim", async () => {
  const client = new FakeGitHubClient();
  let now = new Date("2026-01-01T00:00:00.000Z");
  const control = new GitHubControlPlane({ client, repository: "owner/private-control", branch: "main", leasePath: ".prompthub/active-jobs.json", leaseTtlMs: 1000, maxActiveJobs: 2, now: () => now });
  const created = await control.createJob(validateJobInput({ prompt: "fence stale runners", project: "demo" }, { allowedProjects: ["demo"] }));
  const firstClaim = await control.claimJob(created.id, "runner-old");
  now = new Date("2026-01-01T00:00:01.000Z");
  await control.recoverStaleJobs();
  assert.equal((await control.getJob(created.id)).status, "stale");

  await control.approveJob(created.id, "owner", "resume");
  const secondClaim = await control.claimJob(created.id, "runner-new");
  assert.ok(secondClaim.lease_generation > firstClaim.lease_generation);
  await assert.rejects(
    () => control.completeJob(created.id, "runner-old", "succeeded", { requiredChecks: { passed: true, names: ["test"] } }, firstClaim.lease_generation),
    /active lease not found|already completed/,
  );
  assert.equal((await control.getJob(created.id)).status, "running");

  await control.completeJob(created.id, "runner-new", "succeeded", { requiredChecks: { passed: true, names: ["test"] } }, secondClaim.lease_generation);
  assert.equal((await control.getJob(created.id)).status, "succeeded");
});

test("concurrent resume approvals commit one canonical decision", async () => {
  const client = new FakeGitHubClient();
  let now = new Date("2026-01-01T00:00:00.000Z");
  const controlA = new GitHubControlPlane({ client, repository: "owner/private-control", branch: "main", leasePath: ".prompthub/active-jobs.json", leaseTtlMs: 1000, maxActiveJobs: 2, now: () => now });
  const controlB = new GitHubControlPlane({ client, repository: "owner/private-control", branch: "main", leasePath: ".prompthub/active-jobs.json", leaseTtlMs: 1000, maxActiveJobs: 2, now: () => now });
  const created = await controlA.createJob(validateJobInput({ prompt: "resume once", project: "demo" }, { allowedProjects: ["demo"] }));
  await controlA.claimJob(created.id, "runner-old");
  now = new Date("2026-01-01T00:00:01.000Z");
  await controlA.recoverStaleJobs();

  const decisions = await Promise.allSettled([
    controlA.approveJob(created.id, "owner-a", "resume"),
    controlB.approveJob(created.id, "owner-b", "resume"),
  ]);
  assert.equal(decisions.filter((decision) => decision.status === "fulfilled").length, 1);
  const job = await controlA.getJob(created.id);
  assert.equal(job.status, "queued");
  assert.equal(job.events.filter((event) => event.type === "resumed").length, 1);
});

test("repeated completion by the same fencing generation is idempotent", async () => {
  const client = new FakeGitHubClient();
  const control = new GitHubControlPlane({ client, repository: "owner/private-control", branch: "main", leasePath: ".prompthub/active-jobs.json", leaseTtlMs: 120000, maxActiveJobs: 2 });
  const created = await control.createJob(validateJobInput({ prompt: "complete once", project: "demo" }, { allowedProjects: ["demo"] }));
  const claim = await control.claimJob(created.id, "runner-a");
  const details = { requiredChecks: { passed: true, names: ["test"] } };

  await control.completeJob(created.id, "runner-a", "succeeded", details, claim.lease_generation);
  const repeated = await control.completeJob(created.id, "runner-a", "succeeded", details, claim.lease_generation);
  assert.equal(repeated.status, "succeeded");
  assert.equal((await control.getJob(created.id)).events.filter((event) => event.type === "completed").length, 1);
});

test("canonical job status survives a stale GitHub issue label projection", async () => {
  const client = new FakeGitHubClient();
  const control = new GitHubControlPlane({ client, repository: "owner/private-control", branch: "main", leasePath: ".prompthub/active-jobs.json", leaseTtlMs: 120000, maxActiveJobs: 2 });
  const created = await control.createJob(validateJobInput({ prompt: "labels are a projection", project: "demo" }, { allowedProjects: ["demo"] }));
  const claim = await control.claimJob(created.id, "runner-a");
  await control.completeJob(created.id, "runner-a", "succeeded", { requiredChecks: { passed: true, names: ["test"] } }, claim.lease_generation);
  client.issues[0].labels = [{ name: "prompthub:queued" }];

  assert.equal((await control.getJob(created.id)).status, "succeeded");
  assert.equal((await control.listJobs())[0].status, "succeeded");
});

test("legacy running or terminal issue labels migrate to stale review state", async () => {
  const client = new FakeGitHubClient();
  const control = new GitHubControlPlane({ client, repository: "owner/private-control", branch: "main", leasePath: ".prompthub/active-jobs.json", leaseTtlMs: 120000, maxActiveJobs: 2 });
  const labels = { running: "prompthub:running", succeeded: "prompthub:succeeded", failed: "prompthub:failed" };
  for (const legacyStatus of Object.keys(labels)) {
    const created = await control.createJob(validateJobInput({ prompt: `reconcile legacy ${legacyStatus}`, project: "demo" }, { allowedProjects: ["demo"] }));
    client.files.delete(`.prompthub/jobs/${created.id}.json`);
    const issue = client.issues.find((item) => item.number === created.issue_number);
    issue.labels = [{ name: labels[legacyStatus] }];

    assert.equal((await control.getJob(created.id)).status, "stale");
    const imported = JSON.parse(client.files.get(`.prompthub/jobs/${created.id}.json`).content);
    assert.equal(imported.last_decision.reason, "legacy_issue_status_imported_for_reconciliation");
    assert.deepEqual(imported.required_checks, { passed: false, names: [] });
  }
});

test("a missing lease file blocks recovery and new claims while a canonical job is running", async () => {
  const client = new FakeGitHubClient();
  const control = new GitHubControlPlane({ client, repository: "owner/private-control", branch: "main", leasePath: ".prompthub/active-jobs.json", leaseTtlMs: 120000, maxActiveJobs: 2 });
  const running = await control.createJob(validateJobInput({ prompt: "preserve missing lease state", project: "demo" }, { allowedProjects: ["demo"] }));
  const queued = await control.createJob(validateJobInput({ prompt: "do not exceed cap during missing lease state", project: "demo" }, { allowedProjects: ["demo"] }));
  await control.claimJob(running.id, "runner-a");
  client.leaseFile = null;

  await assert.rejects(() => control.recoverStaleJobs(), /lease ledger is missing/);
  await assert.rejects(() => control.claimJob(queued.id, "runner-b"), /lease ledger is missing/);
  assert.equal((await control.getJob(running.id)).status, "running");
});

test("an orphaned canonical running job blocks recovery and every new claim", async () => {
  const client = new FakeGitHubClient();
  const control = new GitHubControlPlane({ client, repository: "owner/private-control", branch: "main", leasePath: ".prompthub/active-jobs.json", leaseTtlMs: 120000, maxActiveJobs: 2 });
  const running = await control.createJob(validateJobInput({ prompt: "preserve an orphaned running record", project: "demo" }, { allowedProjects: ["demo"] }));
  const queued = await control.createJob(validateJobInput({ prompt: "do not claim while state is unclear", project: "demo" }, { allowedProjects: ["demo"] }));
  await control.claimJob(running.id, "runner-a");
  client.issues = client.issues.filter((issue) => issue.number !== running.issue_number);

  await assert.rejects(() => control.recoverStaleJobs(), /running canonical job has no GitHub issue/);
  await assert.rejects(() => control.claimJob(queued.id, "runner-b"), /canonical running job has no GitHub issue/);
  assert.equal(JSON.parse(client.leaseFile.content).leases.length, 1);
});

test("the complete tree fallback detects a running state outside a capped contents response", async () => {
  const client = new FakeGitHubClient();
  const control = new GitHubControlPlane({ client, repository: "owner/private-control", branch: "main", leasePath: ".prompthub/active-jobs.json", leaseTtlMs: 120000, maxActiveJobs: 2 });
  const running = await control.createJob(validateJobInput({ prompt: "enumerate all canonical jobs", project: "demo" }, { allowedProjects: ["demo"] }));
  const queued = await control.createJob(validateJobInput({ prompt: "do not hide an existing running job", project: "demo" }, { allowedProjects: ["demo"] }));
  await control.claimJob(running.id, "runner-a");
  const leaseState = JSON.parse(client.leaseFile.content);
  leaseState.leases = [];
  client.leaseFile.content = JSON.stringify(leaseState);
  client.forceContentsLimit = true;

  await assert.rejects(() => control.claimJob(queued.id, "runner-b"), /canonical running job has no matching active lease/);
  assert.equal(client.treeDirectoryCalls, 1);
  assert.equal(client.readRefs.includes("tree-snapshot-sha"), true);
});

test("incomplete canonical job tree listings block new claims", async () => {
  const client = new FakeGitHubClient();
  const control = new GitHubControlPlane({ client, repository: "owner/private-control", branch: "main", leasePath: ".prompthub/active-jobs.json", leaseTtlMs: 120000, maxActiveJobs: 2 });
  const created = await control.createJob(validateJobInput({ prompt: "fail closed on truncated tree data", project: "demo" }, { allowedProjects: ["demo"] }));
  client.forceContentsLimit = true;
  client.failTreeListing = true;

  await assert.rejects(() => control.claimJob(created.id, "runner-a"), /tree listing is incomplete/);
  assert.equal(JSON.parse(client.leaseFile.content).leases.length, 0);
});

test("a missing initialized job-state directory blocks recovery and new claims", async () => {
  const client = new FakeGitHubClient();
  const control = new GitHubControlPlane({ client, repository: "owner/private-control", branch: "main", leasePath: ".prompthub/active-jobs.json", leaseTtlMs: 120000, maxActiveJobs: 2 });
  const running = await control.createJob(validateJobInput({ prompt: "remember initialized state files", project: "demo" }, { allowedProjects: ["demo"] }));
  const queued = await control.createJob(validateJobInput({ prompt: "do not treat missing ledger as empty", project: "demo" }, { allowedProjects: ["demo"] }));
  await control.claimJob(running.id, "runner-a");
  const leaseState = JSON.parse(client.leaseFile.content);
  leaseState.leases = [];
  client.leaseFile.content = JSON.stringify(leaseState);
  client.missingJobDirectory = true;

  await assert.rejects(() => control.recoverStaleJobs(), /job-state directory is missing after initialization/);
  await assert.rejects(() => control.claimJob(queued.id, "runner-b"), /job-state directory is missing after initialization/);
});

test("legacy leases cannot resume or complete canonical running generations", async () => {
  const client = new FakeGitHubClient();
  const control = new GitHubControlPlane({ client, repository: "owner/private-control", branch: "main", leasePath: ".prompthub/active-jobs.json", leaseTtlMs: 120000, maxActiveJobs: 2 });
  const running = await control.createJob(validateJobInput({ prompt: "require fencing during lease migration", project: "demo" }, { allowedProjects: ["demo"] }));
  const queued = await control.createJob(validateJobInput({ prompt: "block claims until migration is understood", project: "demo" }, { allowedProjects: ["demo"] }));
  const claim = await control.claimJob(running.id, "runner-a");
  const current = JSON.parse(client.leaseFile.content);
  client.leaseFile.content = JSON.stringify({ version: 1, leases: current.leases.map(({ generation, ...lease }) => lease) });

  await assert.rejects(() => control.heartbeat(running.id, "runner-a", "running", claim.lease_generation), /no fencing generation/);
  await assert.rejects(() => control.completeJob(running.id, "runner-a", "failed", {}, claim.lease_generation), /no fencing generation/);
  await assert.rejects(() => control.recoverStaleJobs(), /legacy lease ledger contains unfenced leases/);
  await assert.rejects(() => control.claimJob(queued.id, "runner-b"), /legacy lease ledger contains unfenced leases/);
  assert.equal((await control.getJob(running.id)).status, "running");
});

test("recovery releases a completed job lease after a transient release failure", async () => {
  const client = new FakeGitHubClient();
  const control = new GitHubControlPlane({ client, repository: "owner/private-control", branch: "main", leasePath: ".prompthub/active-jobs.json", leaseTtlMs: 120000, maxActiveJobs: 2 });
  const created = await control.createJob(validateJobInput({ prompt: "recover after lease release failure", project: "demo" }, { allowedProjects: ["demo"] }));
  const claim = await control.claimJob(created.id, "runner-a");
  client.failNextLeaseWrite = true;

  await assert.rejects(() => control.completeJob(created.id, "runner-a", "succeeded", { requiredChecks: { passed: true, names: ["test"] } }, claim.lease_generation), /simulated lease write failure/);
  assert.equal(JSON.parse(client.leaseFile.content).leases.length, 1);
  assert.equal((await control.getJob(created.id)).status, "succeeded");

  await control.recoverStaleJobs();
  assert.equal(JSON.parse(client.leaseFile.content).leases.length, 0);
  assert.equal((await control.getJob(created.id)).events.filter((event) => event.type === "completed").length, 1);
});

test("recovery repairs status and event projections after completion commits", async () => {
  const client = new FakeGitHubClient();
  const control = new GitHubControlPlane({ client, repository: "owner/private-control", branch: "main", leasePath: ".prompthub/active-jobs.json", leaseTtlMs: 120000, maxActiveJobs: 2 });
  const created = await control.createJob(validateJobInput({ prompt: "repair a failed completion projection", project: "demo" }, { allowedProjects: ["demo"] }));
  const claim = await control.claimJob(created.id, "runner-a");
  client.failNextIssueUpdate = true;

  await assert.rejects(() => control.completeJob(created.id, "runner-a", "succeeded", { requiredChecks: { passed: true, names: ["test"] } }, claim.lease_generation), /simulated issue projection failure/);
  assert.equal(JSON.parse(client.leaseFile.content).leases.length, 0);
  assert.equal((await control.getJob(created.id)).status, "succeeded");

  await control.recoverStaleJobs();
  const recovered = await control.getJob(created.id);
  assert.equal(client.issues[0].labels.some((label) => label.name === "prompthub:succeeded"), true);
  assert.equal(recovered.events.filter((event) => event.type === "completed").length, 1);
});

test("duplicate projected events are returned once without collapsing events that lack IDs", async () => {
  const client = new FakeGitHubClient();
  const control = new GitHubControlPlane({ client, repository: "owner/private-control", branch: "main", leasePath: ".prompthub/active-jobs.json", leaseTtlMs: 120000, maxActiveJobs: 2 });
  const created = await control.createJob(validateJobInput({ prompt: "dedupe event projection", project: "demo" }, { allowedProjects: ["demo"] }));
  const existing = client.comments.get(created.issue_number)[0];
  const eventPayload = existing.body.match(/<!-- prompthub-event:v1 ([A-Za-z0-9_-]+)/)[1];
  const legacyEvent = JSON.parse(decodeBase64Url(eventPayload));
  delete legacyEvent.event_id;
  const legacyWithoutId = { ...existing, body: `<!-- prompthub-event:v1 ${encodeBase64Url(JSON.stringify(legacyEvent))} -->\nlegacy` };
  client.comments.get(created.issue_number).push(existing, legacyWithoutId);

  const loaded = await control.getJob(created.id);
  assert.equal(loaded.events.filter((event) => event.event_id === loaded.events[0].event_id).length, 1);
  assert.equal(loaded.events.filter((event) => event.event_id === undefined).length, 1);
  assert.match(loaded.events[0].event_id, /^evt_[A-Za-z0-9-]{1,100}$/);
});

test("runner recovery repairs stale issue status and missing terminal event from the canonical ledger", async () => {
  const client = new FakeGitHubClient();
  const control = new GitHubControlPlane({ client, repository: "owner/private-control", branch: "main", leasePath: ".prompthub/active-jobs.json", leaseTtlMs: 120000, maxActiveJobs: 2 });
  const created = await control.createJob(validateJobInput({ prompt: "repair status projections", project: "demo" }, { allowedProjects: ["demo"] }));
  const claim = await control.claimJob(created.id, "runner-a");
  await control.completeJob(created.id, "runner-a", "succeeded", { requiredChecks: { passed: true, names: ["test"] } }, claim.lease_generation);
  client.issues[0].labels = [{ name: "prompthub:queued" }];
  client.comments.set(created.issue_number, client.comments.get(created.issue_number).filter((comment) => control.parseEvent(comment.body)?.type !== "completed"));

  await control.recoverStaleJobs();
  const final = await control.getJob(created.id);
  assert.equal(final.status, "succeeded");
  assert.equal(client.issues[0].labels.some((label) => label.name === "prompthub:succeeded"), true);
  assert.equal(final.events.filter((event) => event.type === "completed").length, 1);
});
