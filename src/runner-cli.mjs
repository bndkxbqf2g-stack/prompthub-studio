import process from "node:process";
import { readConfig } from "./config.mjs";
import { createControlPlane, createGitHubClient } from "./control/index.mjs";
import { GitHubProjectStore } from "./projects/project-store.mjs";
import { ProjectService } from "./projects/project-service.mjs";
import { ErrorLearningEngine } from "./knowledge/error-learning.mjs";
import { ProcessExecutor } from "./runner/executor.mjs";
import { PromptHubRunner } from "./runner/runner.mjs";
import { GitWorktreeManager } from "./runner/worktree.mjs";

const config = readConfig();
if (config.mode !== "github") {
  console.error("Runner not configured: PROMPTHUB_MODE=github is required for durable jobs");
  process.exitCode = 2;
} else if (!config.runner.codexExecutable) {
  console.error("Runner not configured: CODEX_EXECUTABLE is required; no work was started");
  process.exitCode = 2;
} else {
  const client = createGitHubClient(config);
  const controlPlane = createControlPlane(config, { githubClient: client });
  await controlPlane.assertRepositorySafety();
  const projectService = new ProjectService({
    store: new GitHubProjectStore({ client, controlRepository: config.github.repository, branch: config.github.branch }),
    client,
    controlPlane,
    controlRepository: config.github.repository,
  });
  const outcomeRecorder = new ErrorLearningEngine({ projectService });
  const runner = new PromptHubRunner({
    controlPlane,
    executor: new ProcessExecutor({ executable: config.runner.codexExecutable, args: config.runner.codexArgs }),
    worktrees: new GitWorktreeManager({ projectRoot: config.runner.projectRoot, projectPaths: config.runner.projectPaths }),
    outcomeRecorder,
    config,
    logger: console,
  });
  process.once("SIGINT", () => runner.stop());
  process.once("SIGTERM", () => runner.stop());
  await runner.runLoop();
}
