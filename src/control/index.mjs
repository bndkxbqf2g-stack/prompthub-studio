import { GitHubClient } from "./github-client.mjs";
import { GitHubControlPlane } from "./github-control-plane.mjs";
import { MemoryControlPlane } from "./memory-control-plane.mjs";

export function createControlPlane(config, { fetchImpl = globalThis.fetch, now, githubClient } = {}) {
  if (config.mode === "memory") return new MemoryControlPlane({ maxActiveJobs: config.runner.maxActiveJobs, leaseTtlMs: config.runner.leaseTtlMs, now });
  const client = githubClient ?? new GitHubClient({ token: config.github.token, apiUrl: config.github.apiUrl, fetchImpl });
  return new GitHubControlPlane({
    client,
    repository: config.github.repository,
    branch: config.github.branch,
    leasePath: config.runner.leasePath,
    leaseTtlMs: config.runner.leaseTtlMs,
    maxActiveJobs: config.runner.maxActiveJobs,
    requirePrivate: config.github.requirePrivate,
    now,
  });
}

export function createGitHubClient(config, { fetchImpl = globalThis.fetch } = {}) {
  return new GitHubClient({ token: config.github.token, apiUrl: config.github.apiUrl, fetchImpl });
}
