import test from "node:test";
import assert from "node:assert/strict";
import { createJob, transitionJob, validateJobInput } from "../src/domain/job.mjs";

test("validates jobs and rejects common secret patterns", () => {
  const input = validateJobInput({ prompt: "Implement a safe feature", project: "demo" }, { allowedProjects: ["demo"] });
  assert.equal(input.project, "demo");
  assert.throws(() => validateJobInput({ prompt: "use ghp_abcdefghijklmnopqrstuvwxyz123456", project: "demo" }, { allowedProjects: ["demo"] }), /secret/);
  assert.throws(() => validateJobInput({ prompt: "anything", project: "other" }, { allowedProjects: ["demo"] }), /allowlist/);
});

test("succeeded is impossible without passing required checks", () => {
  const job = createJob({ prompt: "feature", project: "demo", baseRef: "main", priority: 50, requiresApproval: false });
  assert.throws(() => transitionJob(transitionJob(job, "running"), "succeeded"), /required checks/);
  const running = transitionJob(job, "running");
  const succeeded = transitionJob(running, "succeeded", { details: { requiredChecks: { passed: true, names: ["npm test"] } } });
  assert.equal(succeeded.required_checks.passed, true);
  assert.deepEqual(succeeded.required_checks.names, ["npm test"]);
});
