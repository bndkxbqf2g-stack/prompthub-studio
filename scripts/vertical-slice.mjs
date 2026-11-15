import { readConfig } from "../src/config.mjs";
import { MemoryControlPlane } from "../src/control/memory-control-plane.mjs";
import { validateJobInput } from "../src/domain/job.mjs";
import { ScriptedExecutor } from "../src/runner/executor.mjs";
import { PromptHubRunner } from "../src/runner/runner.mjs";

const config = readConfig({
  NODE_ENV: "test",
  PROMPTHUB_MODE: "memory",
  AUTH_MODE: "local",
  PROMPTHUB_ALLOWED_PROJECTS: "demo",
  CODEX_ARGS_JSON: '["exec","--","$PROMPTHUB_PROMPT"]',
});
const controlPlane = new MemoryControlPlane({ maxActiveJobs: 2 });
const input = validateJobInput({ prompt: "Demo: prüfe die vertikale Kette", project: "demo" }, { allowedProjects: config.runner.allowedProjects });
const created = await controlPlane.createJob(input);
const runner = new PromptHubRunner({
  controlPlane,
  executor: new ScriptedExecutor([{ ok: true, exitCode: 0 }]),
  worktrees: { prepare: async () => ({ path: process.cwd(), resumed: true }) },
  checkRunner: async () => ({ passed: true, names: ["demo-check"] }),
  config,
  runnerId: "demo-runner",
  logger: { info() {}, error() {} },
});
const result = await runner.runOnce();
const finalJob = await controlPlane.getJob(created.id);
console.log(JSON.stringify({ created: created.id, result, final_status: finalJob.status, events: finalJob.events.length }, null, 2));
