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
  const results = await Promise.all([1, 2, 3].map((index) => store.acquire(`job-${index}`, `runner-${index}`)));
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
