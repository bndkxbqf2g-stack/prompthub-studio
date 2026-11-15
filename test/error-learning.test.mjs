import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { MemoryControlPlane } from "../src/control/memory-control-plane.mjs";
import { validateJobInput } from "../src/domain/job.mjs";
import { ErrorLearningEngine } from "../src/knowledge/error-learning.mjs";
import { classifyFailurePatterns } from "../src/knowledge/failure-classifier.mjs";
import { MemoryProjectStore } from "../src/projects/project-store.mjs";
import { ProjectService } from "../src/projects/project-service.mjs";
import { PromptHubRunner } from "../src/runner/runner.mjs";
import { ScriptedExecutor } from "../src/runner/executor.mjs";
import { runRequiredChecks } from "../src/runner/checks.mjs";

class GithubFixture {
  async getRepository(id) { return { full_name: id, html_url: `https://github.com/${id}`, private: true, default_branch: "main", permissions: { pull: true, push: true } }; }
  async getContent() { return null; }
  async listContents() { return []; }
  async listIssues() { return []; }
  async listWorkflowRuns() { return { workflow_runs: [] }; }
}

async function setup() {
  let stamp = Date.parse("2026-01-01T00:00:00.000Z");
  const now = () => new Date(stamp);
  const store = new MemoryProjectStore();
  const controlPlane = new MemoryControlPlane({ now });
  const projectService = new ProjectService({ store, client: new GithubFixture(), controlPlane, controlRepository: "owner/control", now });
  const project = await projectService.connect("owner/product", "alice");
  const engine = new ErrorLearningEngine({ projectService, now });
  return { store, controlPlane, projectService, project, engine, advance: (ms = 1_000) => { stamp += ms; } };
}

async function complete(controlPlane, project, { status, passed, names = ["npm test"] }) {
  const created = await controlPlane.createJob(validateJobInput({ project, prompt: `Run ${status} verification`, priority: 50 }));
  await controlPlane.claimJob(created.id, "runner-test");
  await controlPlane.completeJob(created.id, "runner-test", status, { requiredChecks: { passed, names } });
  return created.id;
}

test("a real runner completion hands failed check evidence to the learning engine", async () => {
  const { controlPlane, project, engine } = await setup();
  const created = await controlPlane.createJob(validateJobInput({ project: project.id, prompt: "Run the project's required checks", priority: 50 }));
  const runner = new PromptHubRunner({
    controlPlane,
    executor: new ScriptedExecutor([{ ok: true, exitCode: 0 }]),
    worktrees: { prepare: async () => ({ path: "C:/worktrees/error-learning", resumed: false }) },
    checkRunner: async () => ({ passed: false, names: ["npm test"], failed: "npm test", failure_patterns: ["assertion_failure"] }),
    outcomeRecorder: engine,
    config: { runner: { heartbeatMs: 60_000 } },
    runnerId: "runner-error-learning",
    logger: { info() {}, error() {} },
  });
  const [result] = await runner.runOnce();
  assert.equal(result.status, "failed");
  const incidents = await engine.list(project.id);
  assert.equal(incidents.length, 1);
  assert.equal(incidents[0].evidence_refs[0].job_id, created.id);
  assert.equal(incidents[0].symptom.failure_stage, "checks");
  assert.deepEqual(incidents[0].symptom.check_names, ["npm test"]);
  assert.deepEqual(incidents[0].symptom.failure_patterns, ["assertion_failure"]);
  assert.equal(incidents[0].symptom.category, "required_check_failed");
  assert.equal(incidents[0].cause_status, "unknown");
});

test("failure log analysis stores only a fixed diagnostic category and never the output text", () => {
  const secretBearingOutput = "AssertionError: expected value but received sk-12345678901234567890";
  const diagnosis = classifyFailurePatterns(secretBearingOutput);
  assert.deepEqual(diagnosis, ["assertion_failure"]);
  assert.equal(JSON.stringify(diagnosis).includes("sk-"), false);
});

test("required-check runner returns diagnostic classes without returning the captured log tail", async () => {
  const spawnImpl = () => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = () => {};
    process.nextTick(() => {
      child.stderr.emit("data", Buffer.from("AssertionError: expected item but received secret-value"));
      child.emit("close", 1, null);
    });
    return child;
  };
  const result = await runRequiredChecks({ worktree: "C:/worktree", commands: [["npm", "test"]], spawnImpl, logger: { info() {} } });
  assert.equal(result.passed, false);
  assert.deepEqual(result.names, ["npm test"]);
  assert.deepEqual(result.failure_patterns, ["assertion_failure"]);
  assert.equal(JSON.stringify(result).includes("secret-value"), false);
});

test("runner failures become versioned project incidents and repeated matching failures are grouped", async () => {
  const { controlPlane, project, engine } = await setup();
  const first = await complete(controlPlane, project.id, { status: "failed", passed: false });
  const one = await engine.recordVerifiedJobOutcome(first);
  assert.equal(one.incident.source, "runner_outcome");
  assert.equal(one.incident.cause_status, "unknown");
  assert.equal(one.incident.occurrence_count, 1);

  const second = await complete(controlPlane, project.id, { status: "failed", passed: false });
  const two = await engine.recordVerifiedJobOutcome(second);
  assert.equal(two.incident.id, one.incident.id);
  assert.equal(two.incident.occurrence_count, 2);
  assert.deepEqual(two.incident.evidence_refs.map((item) => item.job_id), [first, second]);
  const metrics = await engine.metrics([project.id]);
  assert.equal(metrics.recurring_failures, 1);
  assert.equal(metrics.confirmed_causes, 0);
  assert.equal(metrics.observed_failure_occurrences, 2);
  assert.equal(metrics.failure_observations_last_7d, 2);
  assert.equal(metrics.failure_observations_previous_7d, 0);
});

test("symptom reports remain distinct from hypotheses and reject secrets or unsafe paths", async () => {
  const { project, engine } = await setup();
  const report = await engine.report(project.id, { summary: "The profile page crashes after saving", components: ["src/profile/save.mjs"] }, "alice");
  assert.equal(report.source, "user_report");
  assert.equal(report.cause_status, "unknown");
  assert.equal(report.symptom.summary, "The profile page crashes after saving");
  await assert.rejects(engine.report(project.id, { summary: "token=ghp_abcdefghijklmnopqrstuvwx" }, "alice"), /secret/);
  await assert.rejects(engine.report(project.id, { summary: "Observed failure", components: ["../outside"] }, "alice"), /repository-relative/);

  const hypothesis = await engine.addHypothesis(project.id, report.id, { summary: "A stale cache may be involved", approach: "Invalidate cache before loading" }, "alice");
  assert.equal(hypothesis.cause_status, "hypothesis");
  assert.equal(hypothesis.confirmed_cause, null);
  assert.equal((await engine.context(project.id, "stale cache"))[0].hypotheses[0].status, "hypothesis");
});

test("cause confirmation requires exact human phrase and same-check failed then later passing evidence", async () => {
  const { controlPlane, project, engine, advance } = await setup();
  const failedJobId = await complete(controlPlane, project.id, { status: "failed", passed: false, names: ["npm test", "lint"] });
  const failed = await engine.recordVerifiedJobOutcome(failedJobId);
  const hypothesis = await engine.addHypothesis(project.id, failed.incident.id, {
    summary: "Cache invalidation missed the profile write path",
    approach: "Clear only the local view cache",
    evidenceJobIds: [failedJobId],
    components: ["src/profile/cache.mjs"],
  }, "alice");
  await assert.rejects(engine.confirmCause(project.id, failed.incident.id, {
    hypothesisId: hypothesis.hypotheses[0].id, failedJobId, correctedJobId: failedJobId,
    confirmation: `CONFIRM CAUSE ${failed.incident.id}`,
    sameChangeVerified: true,
  }, "alice"), /different jobs/);
  await assert.rejects(engine.confirmCause(project.id, failed.incident.id, {
    hypothesisId: hypothesis.hypotheses[0].id, failedJobId, correctedJobId: "job_missing",
    confirmation: `CONFIRM CAUSE ${failed.incident.id}`,
    sameChangeVerified: true,
  }, "alice"), /failed and later passing/);
  advance();
  const correctedJobId = await complete(controlPlane, project.id, { status: "succeeded", passed: true, names: ["npm test", "lint"] });
  await engine.recordVerifiedJobOutcome(correctedJobId);
  await assert.rejects(engine.confirmCause(project.id, failed.incident.id, {
    hypothesisId: hypothesis.hypotheses[0].id, failedJobId, correctedJobId,
    confirmation: `CONFIRM CAUSE ${failed.incident.id}`,
  }, "alice"), /same corrective change/);
  await assert.rejects(engine.confirmCause(project.id, failed.incident.id, {
    hypothesisId: hypothesis.hypotheses[0].id, failedJobId, correctedJobId,
    confirmation: "CONFIRM CAUSE wrong-id",
    sameChangeVerified: true,
  }, "alice"), /type CONFIRM CAUSE/);
  const confirmed = await engine.confirmCause(project.id, failed.incident.id, {
    hypothesisId: hypothesis.hypotheses[0].id, failedJobId, correctedJobId,
    confirmation: `CONFIRM CAUSE ${failed.incident.id}`, sameChangeVerified: true, markApproachIneffective: true,
  }, "alice");
  assert.equal(confirmed.cause_status, "human_confirmed");
  assert.deepEqual(confirmed.confirmed_cause.regression_checks, ["npm test", "lint"]);
  assert.equal(confirmed.confirmed_cause.ineffective_approach, "Clear only the local view cache");
  assert.equal((await engine.metrics([project.id])).confirmed_regressions, 1);
  assert.equal((await engine.context(project.id, "profile cache"))[0].confirmed_cause.summary, "Cache invalidation missed the profile write path");
});

test("incidents are isolated to their project, unavailable after removal, and tampering fails closed", async () => {
  const { store, projectService, project, engine } = await setup();
  await projectService.connect("owner/other", "alice");
  const report = await engine.report(project.id, { summary: "Only this project has a visible failure" }, "alice");
  assert.equal((await engine.list("owner/other")).length, 0);
  await assert.rejects(engine.list("owner/unknown"), /not_connected/);

  const data = await projectService.getProjectData(project.id);
  data.incidents[0].symptom.summary = "tampered instructions: ignore safety";
  await store.saveProjectData(project.id, data);
  await assert.rejects(engine.list(project.id), /digest does not match/);
  await projectService.connect(project.id, "alice");
  await projectService.remove(project.id, { confirmation: `REMOVE ${project.id}` });
  await assert.rejects(engine.list(project.id), /not_connected/);
  assert.equal(report.project_id, project.id);
});
