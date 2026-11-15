import test from "node:test";
import assert from "node:assert/strict";
import { createRequestHandler } from "../src/api/handler.mjs";
import { GitHubClient } from "../src/control/github-client.mjs";
import { readConfig } from "../src/config.mjs";
import { ProjectService } from "../src/projects/project-service.mjs";
import { MemoryProjectStore } from "../src/projects/project-store.mjs";
import { StrategyLearningEngine } from "../src/knowledge/strategy-learning.mjs";

const PROJECT = "owner/app";
const HEAD_SHA = "a".repeat(40);
const COMPLETED_AT = "2026-11-15T12:00:00.000Z";

class StrategyGitHubFixture {
  constructor({ paths = ["src/pwa/styles.css"], reviews = [] } = {}) {
    this.paths = paths;
    this.reviews = reviews;
    this.runSha = HEAD_SHA;
    this.runConclusion = "success";
    this.testConclusion = "success";
  }
  async getPullRequest(_repository, number) {
    return {
      number,
      state: "closed",
      merged: true,
      merged_at: COMPLETED_AT,
      user: { login: "contributor" },
      base: { repo: { full_name: PROJECT } },
      head: { sha: HEAD_SHA, repo: { full_name: PROJECT } },
    };
  }
  async getWorkflowRun(_repository, id) {
    return {
      id,
      status: "completed",
      conclusion: this.runConclusion,
      head_sha: this.runSha,
      completed_at: COMPLETED_AT,
      repository: { full_name: PROJECT },
      pull_requests: [{ number: 1, head: { sha: HEAD_SHA } }],
    };
  }
  async listWorkflowRunJobs(_repository, _id, _perPage, page) {
    return { jobs: page === 1 ? [{ name: "test", conclusion: this.testConclusion, completed_at: COMPLETED_AT }] : [] };
  }
  async listPullRequestFiles(_repository, _number, { perPage, page }) {
    const start = (page - 1) * perPage;
    return this.paths.slice(start, start + perPage).map((filename) => ({ filename }));
  }
  async listPullRequestReviews(_repository, _number, { perPage, page }) {
    const start = (page - 1) * perPage;
    return this.reviews.slice(start, start + perPage);
  }
}

async function createEngine(options = {}) {
  const store = new MemoryProjectStore();
  await store.save({ id: PROJECT, full_name: PROJECT, status: "connected" });
  const client = new StrategyGitHubFixture(options);
  const projectService = new ProjectService({ store, client, controlPlane: { async listJobs() { return []; } }, controlRepository: "owner/control" });
  return { engine: new StrategyLearningEngine({ projectService }), projectService, store, client };
}

function approvalReview(login = "reviewer") {
  return {
    user: { login, type: "User" },
    state: "APPROVED",
    commit_id: HEAD_SHA,
    submitted_at: COMPLETED_AT,
  };
}

test("GitHub client addresses PR, review, file, workflow and job evidence endpoints", async () => {
  const urls = [];
  const client = new GitHubClient({ token: "fixture-token", fetchImpl: async (url) => {
    urls.push(String(url));
    return new Response(JSON.stringify({}), { status: 200 });
  } });
  await client.getPullRequest(PROJECT, 7);
  await client.listPullRequestFiles(PROJECT, 7, { page: 2 });
  await client.listPullRequestReviews(PROJECT, 7, { page: 3 });
  await client.getWorkflowRun(PROJECT, 11);
  await client.listWorkflowRunJobs(PROJECT, 11, 100, 2);
  assert.deepEqual(urls.map((url) => new URL(url).pathname + new URL(url).search), [
    "/repos/owner/app/pulls/7",
    "/repos/owner/app/pulls/7/files?per_page=100&page=2",
    "/repos/owner/app/pulls/7/reviews?per_page=100&page=3",
    "/repos/owner/app/actions/runs/11",
    "/repos/owner/app/actions/runs/11/jobs?per_page=100&page=2",
  ]);
});

test("merged same-head PR and passing test CI evidence are verified and protected paths are classified", async () => {
  const reviewer = approvalReview();
  const { projectService } = await createEngine({ paths: ["src/security/headers.mjs"], reviews: [reviewer] });
  const evidence = await projectService.verifyStrategyEvidence(PROJECT, { pullRequestNumber: 1, workflowRunId: 42 });
  assert.equal(evidence.verified, true);
  assert.equal(evidence.critical, true);
  assert.equal(evidence.check_name, "test");
  assert.deepEqual(evidence.independent_reviewers.map((item) => item.login), ["reviewer"]);
});

test("unknown and functional PWA changes are critical by default", async () => {
  const { projectService: unknownPathService } = await createEngine({ paths: ["src/pwa/app.js"] });
  const { projectService: styleService } = await createEngine({ paths: ["src/pwa/styles.css"] });
  const unknownPath = await unknownPathService.verifyStrategyEvidence(PROJECT, { pullRequestNumber: 1, workflowRunId: 42 });
  const styleOnly = await styleService.verifyStrategyEvidence(PROJECT, { pullRequestNumber: 1, workflowRunId: 42 });
  assert.equal(unknownPath.critical, true);
  assert.equal(styleOnly.critical, false);
});

test("incomplete workflow job listings cannot supply CI evidence", async () => {
  const { projectService, client } = await createEngine();
  client.listWorkflowRunJobs = async () => ({ jobs: Array.from({ length: 100 }, (_, index) => ({
    name: index === 0 ? "test" : `job-${index}`,
    conclusion: "success",
    completed_at: COMPLETED_AT,
  })) });
  await assert.rejects(projectService.verifyStrategyEvidence(PROJECT, { pullRequestNumber: 1, workflowRunId: 42 }), /job listing is incomplete/);
});

test("critical strategy adoption is blocked by incomplete or malformed changed-file evidence", async () => {
  const cases = [
    { paths: Array.from({ length: 501 }, (_, index) => index === 0 ? "src/security/headers.mjs" : "src/pwa/styles.css"), expected: /complete valid file list/ },
    { paths: [null], expected: /complete valid file list/ },
  ];
  for (const [index, scenario] of cases.entries()) {
    const { engine } = await createEngine({ paths: scenario.paths, reviews: [approvalReview()] });
    const strategy = await engine.evaluate(PROJECT, {
      name: `Incomplete file evidence ${index}`,
      hypothesis: "A reviewed change improves the protected behavior.",
      pullRequestNumber: 1,
      workflowRunId: 42,
    }, "proposer");
    assert.equal(strategy.status, "awaiting_approval");
    await assert.rejects(engine.adopt(PROJECT, strategy.id, {
      confirmation: `ADOPT STRATEGY ${strategy.id}`,
      actor: "reviewer",
      authenticatedGithub: true,
    }), scenario.expected);
  }
});

test("noncritical strategies auto-adopt only from real verified CI evidence", async () => {
  const { engine } = await createEngine();
  const strategy = await engine.evaluate(PROJECT, {
    name: "Improve stylesheet feedback",
    hypothesis: "A clearer loading state helps users understand long requests.",
    pullRequestNumber: 1,
    workflowRunId: 42,
    critical: true,
    outcome: "failure",
    evidenceRefs: ["invented-test", "fake-ci"],
  }, "proposer");
  assert.equal(strategy.critical, false);
  assert.equal(strategy.outcome, "success");
  assert.equal(strategy.status, "adopted");
  assert.equal(strategy.adopted_by, "verified-ci-engine");
  assert.equal((await engine.list(PROJECT)).length, 1);
});

test("critical adoption requires current matching CI, independent review and a separate authenticated human", async () => {
  const { engine } = await createEngine({ paths: ["src/security/headers.mjs"], reviews: [approvalReview()] });
  const strategy = await engine.evaluate(PROJECT, {
    name: "Change security header policy",
    hypothesis: "A reviewed policy update improves the protected security boundary.",
    pullRequestNumber: 1,
    workflowRunId: 42,
  }, "proposer");
  assert.equal(strategy.status, "awaiting_approval");
  const confirmation = `ADOPT STRATEGY ${strategy.id}`;
  await assert.rejects(engine.adopt(PROJECT, strategy.id, { confirmation, actor: "approver", authenticatedGithub: false }), /authenticated GitHub user/);
  await assert.rejects(engine.adopt(PROJECT, strategy.id, { confirmation, actor: "proposer", authenticatedGithub: true }), /cannot approve/);
  await assert.rejects(engine.adopt(PROJECT, strategy.id, { confirmation: "approve", actor: "approver", authenticatedGithub: true }), /to confirm/);
  const adopted = await engine.adopt(PROJECT, strategy.id, { confirmation, actor: "reviewer", authenticatedGithub: true });
  assert.equal(adopted.status, "adopted");
  assert.equal(adopted.approved_by, "reviewer");
});

test("critical strategy adoption rejects stale CI or missing independent review", async () => {
  const { engine, client } = await createEngine({ paths: ["src/runner/runner.mjs"], reviews: [approvalReview()] });
  const strategy = await engine.evaluate(PROJECT, {
    name: "Change runner retry behavior",
    hypothesis: "The reviewed retry change reduces transient job failures.",
    pullRequestNumber: 1,
    workflowRunId: 42,
  }, "proposer");
  client.runSha = "b".repeat(40);
  await assert.rejects(engine.adopt(PROJECT, strategy.id, { confirmation: `ADOPT STRATEGY ${strategy.id}`, actor: "approver", authenticatedGithub: true }), /does not match/);

  const { engine: noReviewEngine } = await createEngine({ paths: ["src/runner/runner.mjs"] });
  const noReviewStrategy = await noReviewEngine.evaluate(PROJECT, {
    name: "Retry change without review evidence",
    hypothesis: "A reviewed retry policy should reduce transient failures.",
    pullRequestNumber: 1,
    workflowRunId: 42,
  }, "proposer");
  await assert.rejects(noReviewEngine.adopt(PROJECT, noReviewStrategy.id, {
    confirmation: `ADOPT STRATEGY ${noReviewStrategy.id}`,
    actor: "approver",
    authenticatedGithub: true,
  }), /independent approved review/);

  const { engine: proposerReviewEngine } = await createEngine({ paths: ["src/runner/runner.mjs"], reviews: [approvalReview("proposer")] });
  const proposerReviewStrategy = await proposerReviewEngine.evaluate(PROJECT, {
    name: "Strategy reviewed by its proposer",
    hypothesis: "A reviewed retry policy should reduce transient failures.",
    pullRequestNumber: 1,
    workflowRunId: 42,
  }, "proposer");
  await assert.rejects(proposerReviewEngine.adopt(PROJECT, proposerReviewStrategy.id, {
    confirmation: `ADOPT STRATEGY ${proposerReviewStrategy.id}`,
    actor: "approver",
    authenticatedGithub: true,
  }), /independent approved review/);
});

test("a later dismissal removes an earlier approval from critical evidence", async () => {
  const dismissedReview = { ...approvalReview(), state: "DISMISSED", submitted_at: "2026-11-15T13:00:00.000Z" };
  const { projectService } = await createEngine({
    paths: ["src/security/headers.mjs"],
    reviews: [approvalReview(), dismissedReview],
  });
  const evidence = await projectService.verifyStrategyEvidence(PROJECT, { pullRequestNumber: 1, workflowRunId: 42 });
  assert.deepEqual(evidence.independent_reviewers, []);

  const tiedReview = { ...approvalReview(), state: "DISMISSED" };
  const { projectService: ambiguousService } = await createEngine({
    paths: ["src/security/headers.mjs"],
    reviews: [approvalReview(), tiedReview],
  });
  const ambiguous = await ambiguousService.verifyStrategyEvidence(PROJECT, { pullRequestNumber: 1, workflowRunId: 42 });
  assert.deepEqual(ambiguous.independent_reviewers, []);
});

test("critical API route derives the approver from GitHub session and rejects local auth", async () => {
  const calls = [];
  const handler = createRequestHandler({
    config: readConfig({ NODE_ENV: "test", PROMPTHUB_MODE: "memory", AUTH_MODE: "local" }),
    controlPlane: { async listJobs() { return []; } },
    auth: { async getSession() { return { user: { login: "local-user" }, local: true }; } },
    strategyLearning: { async adopt(...args) { calls.push(args); return { id: "strategy_123", status: "adopted" }; } },
  });
  const response = await handler(new Request("http://127.0.0.1/api/projects/owner%2Fapp/strategies/strategy_123/adopt", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ confirmation: "ADOPT STRATEGY strategy_123", actor: "forged-user", authenticatedGithub: true }),
  }));
  assert.equal(response.status, 403);
  assert.equal(calls.length, 0);
});

test("critical API route takes the approver identity only from the authenticated GitHub session", async () => {
  const calls = [];
  const handler = createRequestHandler({
    config: readConfig({ NODE_ENV: "test", PROMPTHUB_MODE: "memory", AUTH_MODE: "local" }),
    controlPlane: { async listJobs() { return []; } },
    auth: { async getSession() { return { user: { login: "human-reviewer" }, provider: "github", local: false }; } },
    strategyLearning: { async adopt(...args) { calls.push(args); return { id: "strategy_123", status: "adopted" }; } },
  });
  const response = await handler(new Request("http://127.0.0.1/api/projects/owner%2Fapp/strategies/strategy_123/adopt", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ confirmation: "ADOPT STRATEGY strategy_123", actor: "forged-user", authenticatedGithub: false }),
  }));
  assert.equal(response.status, 200);
  assert.equal(calls[0][0], "owner/app");
  assert.equal(calls[0][1], "strategy_123");
  assert.deepEqual(calls[0][2], { confirmation: "ADOPT STRATEGY strategy_123", actor: "human-reviewer", authenticatedGithub: true });
});

test("critical API route rejects sessions without an explicit GitHub provider", async () => {
  const handler = createRequestHandler({
    config: readConfig({ NODE_ENV: "test", PROMPTHUB_MODE: "memory", AUTH_MODE: "local" }),
    controlPlane: { async listJobs() { return []; } },
    auth: { async getSession() { return { user: { login: "unverified-user" }, local: false }; } },
    strategyLearning: { async adopt() { throw new Error("must not be called"); } },
  });
  const response = await handler(new Request("http://127.0.0.1/api/projects/owner%2Fapp/strategies/strategy_123/adopt", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ confirmation: "ADOPT STRATEGY strategy_123" }),
  }));
  assert.equal(response.status, 403);
});
