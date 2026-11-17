import test from "node:test";
import assert from "node:assert/strict";
import { GitHubApiError } from "../src/control/github-client.mjs";
import { GitHubLeaseStore } from "../src/control/github-lease-store.mjs";

class FakeContentsClient {
  constructor() {
    this.file = null;
    this.revision = 0;
  }

  async getContent() {
    if (!this.file) return null;
    return { content: this.file.content, sha: this.file.sha, path: ".prompthub/active-jobs.json" };
  }

  async putContent(_repository, _path, { content, sha }) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    const currentSha = this.file?.sha ?? null;
    if ((sha ?? null) !== currentSha) throw new GitHubApiError(409, "conflict");
    this.revision += 1;
    this.file = { content, sha: `sha-${this.revision}` };
  }
}

test("GitHub lease CAS admits at most two concurrent jobs", async () => {
  const client = new FakeContentsClient();
  const store = new GitHubLeaseStore({ client, repository: "owner/control", branch: "main", ttlMs: 120000, maxActiveJobs: 2 });
  const results = await Promise.all([1, 2, 3].map((index) => store.acquire(`job_${index}`, `runner-${index}`)));
  assert.equal(results.filter(Boolean).length, 2);
  const state = JSON.parse(client.file.content);
  assert.equal(state.leases.length, 2);
});

test("invalid lease state is never overwritten", async () => {
  const client = new FakeContentsClient();
  client.file = { content: "not-json", sha: "sha-1" };
  const store = new GitHubLeaseStore({ client, repository: "owner/control", branch: "main" });
  await assert.rejects(() => store.acquire("job", "runner"), /invalid/);
  assert.equal(client.file.content, "not-json");
});

test("malformed lease entries fail closed instead of being dropped from the cap", async () => {
  const client = new FakeContentsClient();
  const malformed = JSON.stringify({ version: 1, leases: [{ job_id: "job_old", runner_id: "runner-old", acquired_at: "not-a-date", heartbeat_at: "not-a-date", expires_at: "2099-01-01T00:00:00.000Z" }] });
  client.file = { content: malformed, sha: "sha-1" };
  const store = new GitHubLeaseStore({ client, repository: "owner/control", branch: "main", maxActiveJobs: 2 });

  await assert.rejects(() => store.acquire("job_new", "runner-new"), /invalid lease/);
  assert.equal(client.file.content, malformed);
});

test("same runner identity cannot reacquire an existing active lease", async () => {
  const client = new FakeContentsClient();
  const store = new GitHubLeaseStore({ client, repository: "owner/control", branch: "main" });
  assert.ok(await store.acquire("job_1", "runner-a"));

  assert.equal(await store.acquire("job_1", "runner-a"), null);
  assert.equal(JSON.parse(client.file.content).leases.length, 1);
});

test("expired leases cannot be renewed by a late heartbeat", async () => {
  const client = new FakeContentsClient();
  let now = new Date("2026-01-01T00:00:00.000Z");
  const store = new GitHubLeaseStore({ client, repository: "owner/control", branch: "main", now: () => now, ttlMs: 1000 });
  await store.acquire("job_1", "runner-a");
  now = new Date("2026-01-01T00:00:01.000Z");

  await assert.rejects(() => store.heartbeat("job_1", "runner-a"), /active lease not found/);
});

test("legacy active leases are not assigned synthetic fencing generations", async () => {
  const client = new FakeContentsClient();
  client.file = {
    content: JSON.stringify({ version: 1, leases: [{
      job_id: "job_legacy",
      runner_id: "runner-old",
      acquired_at: "2026-01-01T00:00:00.000Z",
      heartbeat_at: "2026-01-01T00:00:00.000Z",
      expires_at: "2026-01-01T00:02:00.000Z",
    }] }),
    sha: "sha-1",
  };
  let now = new Date("2026-01-01T00:00:30.000Z");
  const store = new GitHubLeaseStore({ client, repository: "owner/control", now: () => now });

  const legacy = await store.readState();
  assert.equal(legacy.legacySchema, true);
  assert.equal(Object.hasOwn(legacy.state.leases[0], "generation"), false);
  await assert.rejects(() => store.acquire("job_new", "runner-new"), /legacy lease ledger contains unfenced leases/);
  assert.equal(JSON.parse(client.file.content).version, 1);
});

test("an empty legacy lease ledger can migrate without inventing active generations", async () => {
  const client = new FakeContentsClient();
  client.file = { content: JSON.stringify({ version: 1, leases: [] }), sha: "sha-1" };
  const store = new GitHubLeaseStore({ client, repository: "owner/control" });

  const next = await store.acquire("job_new", "runner-new");
  const persisted = JSON.parse(client.file.content);
  assert.equal(next.generation, 1);
  assert.equal(persisted.version, 2);
  assert.equal(persisted.next_generation, 2);
  assert.equal(persisted.jobs_initialized, false);
});

test("an over-cap existing lease state fails closed", async () => {
  const client = new FakeContentsClient();
  const active = [1, 2, 3].map((index) => ({
    job_id: `job_${index}`,
    runner_id: `runner-${index}`,
    generation: index,
    acquired_at: "2026-01-01T00:00:00.000Z",
    heartbeat_at: "2026-01-01T00:00:00.000Z",
    expires_at: "2099-01-01T00:00:00.000Z",
  }));
  const original = JSON.stringify({ version: 2, next_generation: 4, leases: active });
  client.file = { content: original, sha: "sha-1" };
  const store = new GitHubLeaseStore({ client, repository: "owner/control", now: () => new Date("2026-01-01T00:00:00.000Z"), maxActiveJobs: 2 });

  await assert.rejects(() => store.acquire("job_new", "runner-new"), /exceeds the global job cap/);
  assert.equal(client.file.content, original);
});

test("the configured global cap cannot exceed two jobs", () => {
  assert.throws(
    () => new GitHubLeaseStore({ client: new FakeContentsClient(), repository: "owner/control", maxActiveJobs: 3 }),
    /must be between one and two/,
  );
});
