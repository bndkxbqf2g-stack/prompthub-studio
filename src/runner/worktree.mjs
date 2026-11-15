import { execFile as nodeExecFile } from "node:child_process";
import { promisify } from "node:util";
import { access, mkdir } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";

const execFile = promisify(nodeExecFile);

export class GitWorktreeManager {
  constructor({ projectRoot, projectPaths = {}, worktreeRoot = join(projectRoot, ".prompthub", "worktrees"), execFileImpl = execFile, gitExecutable = "git" } = {}) {
    this.projectRoot = resolve(projectRoot);
    this.projectPaths = projectPaths;
    this.worktreeRoot = resolve(worktreeRoot);
    this.execFile = execFileImpl;
    this.gitExecutable = gitExecutable;
  }

  resolveProject(project) {
    const configured = this.projectPaths[project];
    if (!configured) throw new Error("project path is not explicitly configured for this runner");
    const repoPath = resolve(isAbsolute(configured) ? configured : join(this.projectRoot, configured));
    const outside = relative(this.projectRoot, repoPath).startsWith("..") || isAbsolute(relative(this.projectRoot, repoPath));
    if (outside) throw new Error("project path is outside the configured project root");
    return repoPath;
  }

  async prepare(job) {
    const repository = this.resolveProject(job.project);
    await access(repository);
    await mkdir(this.worktreeRoot, { recursive: true });
    const worktree = join(this.worktreeRoot, job.id);
    const branch = `prompthub/job/${job.id}`;
    try {
      await access(join(worktree, ".git"));
      try {
        await this.execFile(this.gitExecutable, ["-C", worktree, "switch", branch], { windowsHide: true });
      } catch {
        await this.execFile(this.gitExecutable, ["-C", worktree, "switch", "-c", branch], { windowsHide: true });
      }
      return { path: worktree, repository, branch, resumed: true };
    } catch {
      // The directory is either absent or not a valid worktree; git reports the real error below.
    }
    try {
      await this.execFile(this.gitExecutable, ["-C", repository, "worktree", "add", "--detach", worktree, job.base_ref], { windowsHide: true });
      await this.execFile(this.gitExecutable, ["-C", worktree, "switch", "-c", branch], { windowsHide: true });
    } catch (error) {
      throw error;
    }
    return { path: worktree, repository, branch, resumed: false };
  }
}
