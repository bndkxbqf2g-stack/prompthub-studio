import test from "node:test";
import assert from "node:assert/strict";
import { execFile as nodeExecFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GitWorktreeManager } from "../src/runner/worktree.mjs";

const execFile = promisify(nodeExecFile);

test("worktree manager creates an isolated job branch", async () => {
  const root = await mkdtemp(join(tmpdir(), "prompthub-git-"));
  try {
    await execFile("git", ["init", "-b", "main"], { cwd: root });
    await execFile("git", ["config", "user.email", "prompthub-test@example.invalid"], { cwd: root });
    await execFile("git", ["config", "user.name", "PromptHub Test"], { cwd: root });
    await writeFile(join(root, "README.md"), "fixture\n");
    await execFile("git", ["add", "README.md"], { cwd: root });
    await execFile("git", ["commit", "-m", "fixture"], { cwd: root });
    const manager = new GitWorktreeManager({ projectRoot: root, projectPaths: { demo: "." } });
    const result = await manager.prepare({ id: "job_fixture", project: "demo", base_ref: "main" });
    assert.equal(result.resumed, false);
    assert.equal(result.branch, "prompthub/job/job_fixture");
    const branch = await execFile("git", ["-C", result.path, "branch", "--show-current"]);
    assert.equal(branch.stdout.trim(), result.branch);
    assert.equal((await readFile(join(result.path, "README.md"), "utf8")).trim(), "fixture");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
