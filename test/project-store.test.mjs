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
