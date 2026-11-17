import test from "node:test";
import assert from "node:assert/strict";
import { readConfig } from "../src/config.mjs";
import { MemoryControlPlane } from "../src/control/memory-control-plane.mjs";
import { validateJobInput } from "../src/domain/job.mjs";
import { ScriptedExecutor } from "../src/runner/executor.mjs";
import { PromptHubRunner } from "../src/runner/runner.mjs";

function config() {
  return readConfig({ NODE_ENV: "test", PROMPTHUB_MODE: "memory", AUTH_MODE: "local", PROMPTHUB_ALLOWED_PROJECTS: "demo", CODEX_ARGS_JSON: '["exec","--","$PROMPTHUB_PROMPT"]', PROMPTHUB_HEARTBEAT_MS: "1000" });
}

function jobInput(prompt) {
  return validateJobInput({ prompt, project: "demo" }, { allowedProjects: ["demo"] });
}

test("runner instances receive distinct lease identities for the same configured host", () => {
  const dependencies = {
    controlPlane: {},
    executor: {},
    worktrees: {},
    config: config(),
    runnerId: "mac-runner",
  };
  const first = new PromptHubRunner({ ...dependencies, runnerInstanceId: "process-one" });
  const second = new PromptHubRunner({ ...dependencies, runnerInstanceId: "process-two" });

  assert.equal(first.runnerId, "mac-runner:process-one");
  assert.notEqual(first.runnerId, second.runnerId);
});

test("runner writes checkpoints and only succeeds after required checks", async () => {
  const control = new MemoryControlPlane({ maxActiveJobs: 2 });
  const created = await control.createJob(jobInput("run the task"));
  const recordedOutcomes = [];
  const runner = new PromptHubRunner({
    controlPlane: control,
    executor: new ScriptedExecutor([{ ok: true, exitCode: 0, usage: { input_tokens: 41, output_tokens: 12, cached_input_tokens: 7, reasoning_output_tokens: 3 } }]),
    worktrees: { prepare: async () => ({ path: "C:/worktrees/job", resumed: false }) },
    checkRunner: async () => ({ passed: true, names: ["test", "check"] }),
    outcomeRecorder: { async recordVerifiedJobOutcome(jobId) { recordedOutcomes.push(jobId); return { created: true }; } },
    config: config(),
    runnerId: "runner-a",
    logger: { info() {}, error() {} },
  });
  const result = await runner.runOnce();
  const finalJob = await control.getJob(created.id);
  assert.equal(result[0].status, "succeeded");
  assert.equal(finalJob.status, "succeeded");
  assert.equal(finalJob.required_checks.passed, true);
  assert.equal(finalJob.resource_metrics.executor_invocations, 1);
  assert.equal(finalJob.resource_metrics.retries, 0);
  assert.equal(finalJob.resource_metrics.model_calls, null);
  assert.deepEqual(finalJob.resource_metrics.token_usage, { input_tokens: 41, output_tokens: 12, cached_input_tokens: 7, reasoning_output_tokens: 3, source: "execution_provider" });
  assert.ok(Number.isFinite(finalJob.resource_metrics.runtime_ms));
  assert.ok(finalJob.events.some((event) => event.type === "checkpoint"));
  assert.equal(control.getActiveLeases().length, 0);
  assert.deepEqual(recordedOutcomes, [created.id]);
});

test("runner reports failed executor without claiming success when outcome persistence fails", async () => {
  const control = new MemoryControlPlane({ maxActiveJobs: 2 });
  const created = await control.createJob(jobInput("fail the task"));
  const runner = new PromptHubRunner({
    controlPlane: control,
    executor: new ScriptedExecutor([{ ok: false, exitCode: 3 }]),
    worktrees: { prepare: async () => ({ path: "C:/worktrees/job", resumed: true }) },
    checkRunner: async () => ({ passed: true, names: ["not-reached"] }),
    outcomeRecorder: { async recordVerifiedJobOutcome() { throw new Error("control repository unavailable"); } },
    config: config(),
    runnerId: "runner-a",
    logger: { info() {}, error() {} },
  });
  const result = await runner.runOnce();
  const finalJob = await control.getJob(created.id);
  assert.equal(result[0].status, "failed");
  assert.equal(finalJob.status, "failed");
  assert.equal(finalJob.required_checks.passed, false);
  assert.equal(finalJob.resource_metrics.executor_invocations, 1);
});
