import test from "node:test";
import assert from "node:assert/strict";
import { GitHubApiError } from "../src/control/github-client.mjs";
import { GitHubProjectStore } from "../src/projects/project-store.mjs";

test("GitHub project-data updates retry CAS conflicts against the latest data instead of overwriting sibling writes", async () => {
  let revision = 0;
  let file = { sha: "sha-0", content: JSON.stringify({ schema: 1, drafts: [], decisions: [], verified_outcomes: [] }) };
  const client = {
    async getContent(_repository, path) {
      assert.equal(path, ".prompthub/project-data/owner%2Fdemo.json");
      return structuredClone(file);
    },
    async putContent(_repository, _path, { content, sha }) {
      if (sha !== file.sha) throw new GitHubApiError(409, "content changed");
      file = { sha: `sha-${++revision}`, content };
    },
  };
  const store = new GitHubProjectStore({ client, controlRepository: "owner/control" });

  await Promise.all([
    store.updateProjectData("owner/demo", (data) => ({ ...data, drafts: [...data.drafts, { id: "draft-a" }] })),
    store.updateProjectData("owner/demo", (data) => ({ ...data, verified_outcomes: [...data.verified_outcomes, { job_id: "job-b" }] })),
  ]);

  const saved = await store.getProjectData("owner/demo");
  assert.deepEqual(saved.drafts, [{ id: "draft-a" }]);
  assert.deepEqual(saved.verified_outcomes, [{ job_id: "job-b" }]);
  assert.equal(revision, 2);
});

test("direct GitHub project-data replacement refuses to replay stale data after a CAS conflict", async () => {
  let file = { sha: "sha-0", content: JSON.stringify({ schema: 1, drafts: [], decisions: [], approvals: [{ id: "approval-live" }] }) };
  let writes = 0;
  const client = {
    async getContent() {
      const snapshot = structuredClone(file);
      file = { sha: "sha-1", content: JSON.stringify({ schema: 1, drafts: [], decisions: [], approvals: [{ id: "approval-live" }], sibling_update: true }) };
      return snapshot;
    },
    async putContent(_repository, _path, { sha }) {
      writes += 1;
      if (sha !== file.sha) throw new GitHubApiError(409, "content changed");
      file = { sha: "sha-wrong", content: "{}" };
    },
  };
  const store = new GitHubProjectStore({ client, controlRepository: "owner/control" });
  const staleSnapshot = { drafts: [{ id: "stale-replacement" }], decisions: [] };

  await assert.rejects(store.saveProjectData("owner/demo", staleSnapshot), /changed concurrently/);
  assert.equal(writes, 1);
  assert.deepEqual(JSON.parse(file.content).approvals, [{ id: "approval-live" }]);
  assert.equal(JSON.parse(file.content).sibling_update, true);
});

test("atomic project-state updates recheck removal reservations after a GitHub CAS conflict", async () => {
  let revision = 0;
  let file = { sha: "sha-0", content: JSON.stringify({ schema: 1, projects: [{ id: "owner/demo", status: "connected" }] }) };
  let releaseRemovalWrite;
  let announceRemovalWrite;
  const removalWriteStarted = new Promise((resolve) => { announceRemovalWrite = resolve; });
  const removalWriteGate = new Promise((resolve) => { releaseRemovalWrite = resolve; });
  const client = {
    async getContent(_repository, path) {
      assert.equal(path, ".prompthub/projects.json");
      return structuredClone(file);
    },
    async putContent(_repository, _path, { content, sha }) {
      if (JSON.parse(content).projects[0].status === "removing" && revision === 0) {
        announceRemovalWrite();
        await removalWriteGate;
      }
      if (sha !== file.sha) throw new GitHubApiError(409, "content changed");
      file = { sha: `sha-${++revision}`, content };
    },
  };
  const store = new GitHubProjectStore({ client, controlRepository: "owner/control" });
  const removing = store.updateProject("owner/demo", (project) => {
    if (project.status !== "connected" || (project.prompt_handoff_claims ?? []).length) throw new Error("project removal is blocked");
    return { ...project, status: "removing" };
  });
  await removalWriteStarted;
  await store.updateProject("owner/demo", (project) => {
    if (project.status !== "connected") throw new Error("project is not connected");
    return { ...project, prompt_handoff_claims: [{ job_id: "job_draft-a", status: "pending" }] };
  });
  releaseRemovalWrite();
  await assert.rejects(removing, /project removal is blocked/);
  const saved = await store.get("owner/demo");
  assert.equal(saved.status, "connected");
  assert.equal(saved.prompt_handoff_claims[0].status, "pending");
  assert.equal(revision, 1);
});
