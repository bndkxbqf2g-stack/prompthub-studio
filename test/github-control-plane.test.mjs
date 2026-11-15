import test from "node:test";
import assert from "node:assert/strict";
import { GitHubControlPlane } from "../src/control/github-control-plane.mjs";
import { validateJobInput } from "../src/domain/job.mjs";

class FakeGitHubClient {
  constructor() {
    this.labels = [];
    this.issues = [];
    this.comments = new Map();
    this.nextIssue = 1;
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
    const issue = this.issues.find((item) => item.number === issueNumber);
    issue.labels = payload.labels.map((name) => ({ name }));
    issue.updated_at = new Date().toISOString();
    return issue;
  }
  async getContent() { return null; }
  async putContent() {}
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
