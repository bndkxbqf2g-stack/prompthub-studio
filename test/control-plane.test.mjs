import test from "node:test";
import assert from "node:assert/strict";
import { MemoryControlPlane } from "../src/control/memory-control-plane.mjs";
import { validateJobInput } from "../src/domain/job.mjs";

function input(prompt, requiresApproval = false) {
  return validateJobInput({ prompt, project: "demo", requiresApproval }, { allowedProjects: ["demo"] });
}

function inputWithDependencies(prompt, dependsOn) {
  return validateJobInput({ prompt, project: "demo", dependsOn }, { allowedProjects: ["demo"] });
}

test("memory control plane enforces the global two-job cap", async () => {
  const control = new MemoryControlPlane({ maxActiveJobs: 2 });
  const jobs = await Promise.all(["one", "two", "three"].map((name) => control.createJob(input(name))));
  const claims = await Promise.all(jobs.map((job) => control.claimJob(job.id, `runner-${job.id}`)));
  assert.equal(claims.filter(Boolean).length, 2);
  assert.equal((await control.listJobs()).filter((job) => job.status === "running").length, 2);
});

test("approval is a human-facing state transition", async () => {
  const control = new MemoryControlPlane({ maxActiveJobs: 2 });
  const job = await control.createJob(input("sensitive change", true));
  assert.equal(job.status, "awaiting_approval");
  assert.equal(await control.claimJob(job.id, "runner"), null);
  const approved = await control.approveJob(job.id, "human-user", "approve");
  assert.equal(approved.status, "queued");
  assert.match(approved.events.at(-1).summary, /human-user/);
});

test("expired lease becomes stale and needs explicit resume approval", async () => {
  let now = new Date("2026-11-15T10:00:00.000Z");
  const control = new MemoryControlPlane({ now: () => now, maxActiveJobs: 2, leaseTtlMs: 1000 });
  const job = await control.createJob(input("resume after interruption"));
  await control.claimJob(job.id, "runner");
  now = new Date("2026-11-15T10:00:02.000Z");
  await control.recoverStaleJobs();
  assert.equal((await control.getJob(job.id)).status, "stale");
  assert.equal(await control.claimJob(job.id, "runner-2"), null);
  const resumed = await control.approveJob(job.id, "human-user", "resume");
  assert.equal(resumed.status, "queued");
});

test("queued jobs with unfinished dependencies are not claimable", async () => {
  const control = new MemoryControlPlane({ maxActiveJobs: 2 });
  const dependency = await control.createJob(input("dependency"));
  const dependent = await control.createJob(inputWithDependencies("dependent", [dependency.id]));
  assert.equal((await control.listQueuedJobs()).some((job) => job.id === dependent.id), false);
  await control.claimJob(dependency.id, "runner");
  await control.completeJob(dependency.id, "runner", "succeeded", { requiredChecks: { passed: true, names: ["check"] } });
  assert.equal((await control.listQueuedJobs()).some((job) => job.id === dependent.id), true);
});
