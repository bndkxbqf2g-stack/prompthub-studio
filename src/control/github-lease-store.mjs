import { GitHubApiError } from "./github-client.mjs";

function emptyState() {
  return { version: 1, leases: [] };
}

function conflict(error) {
  return error instanceof GitHubApiError && (error.status === 409 || error.status === 422);
}

export class GitHubLeaseStore {
  constructor({ client, repository, branch = "main", path = ".prompthub/active-jobs.json", now = () => new Date(), ttlMs = 120000, maxActiveJobs = 2 } = {}) {
    this.client = client;
    this.repository = repository;
    this.branch = branch;
    this.path = path;
    this.now = now;
    this.ttlMs = ttlMs;
    this.maxActiveJobs = maxActiveJobs;
  }

  async readState() {
    const file = await this.client.getContent(this.repository, this.path, this.branch);
    if (!file) return { state: emptyState(), sha: null };
    let state;
    try {
      state = JSON.parse(file.content);
    } catch {
      throw new Error("active-jobs.json is invalid; refusing to overwrite it");
    }
    if (!state || state.version !== 1 || !Array.isArray(state.leases)) {
      throw new Error("active-jobs.json has an unsupported schema; refusing to overwrite it");
    }
    return { state, sha: file.sha };
  }

  activeLeases(state) {
    const now = this.now().toISOString();
    return state.leases.filter((lease) => typeof lease.expires_at === "string" && lease.expires_at > now);
  }

  async writeState(state, sha) {
    await this.client.putContent(this.repository, this.path, {
      content: `${JSON.stringify(state, null, 2)}\n`,
      sha,
      branch: this.branch,
      message: "chore(prompthub): update active job leases",
    });
  }

  async acquire(jobId, runnerId) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const { state, sha } = await this.readState();
      const active = this.activeLeases(state);
      const existing = active.find((lease) => lease.job_id === jobId);
      if (existing) return existing.runner_id === runnerId ? existing : null;
      if (active.length >= this.maxActiveJobs) return null;
      const now = this.now();
      const lease = {
        job_id: jobId,
        runner_id: runnerId,
        acquired_at: now.toISOString(),
        heartbeat_at: now.toISOString(),
        expires_at: new Date(now.getTime() + this.ttlMs).toISOString(),
      };
      const next = { version: 1, leases: [...active, lease] };
      try {
        await this.writeState(next, sha);
        return lease;
      } catch (error) {
        if (!conflict(error) || attempt === 2) throw error;
      }
    }
    return null;
  }

  async heartbeat(jobId, runnerId) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const { state, sha } = await this.readState();
      const index = state.leases.findIndex((lease) => lease.job_id === jobId && lease.runner_id === runnerId);
      if (index === -1) throw new Error("active lease not found");
      const now = this.now();
      const nextLeases = state.leases.slice();
      nextLeases[index] = { ...nextLeases[index], heartbeat_at: now.toISOString(), expires_at: new Date(now.getTime() + this.ttlMs).toISOString() };
      try {
        await this.writeState({ version: 1, leases: nextLeases }, sha);
        return nextLeases[index];
      } catch (error) {
        if (!conflict(error) || attempt === 2) throw error;
      }
    }
    throw new Error("lease heartbeat could not be committed");
  }

  async release(jobId, runnerId) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const { state, sha } = await this.readState();
      const nextLeases = state.leases.filter((lease) => !(lease.job_id === jobId && lease.runner_id === runnerId));
      if (nextLeases.length === state.leases.length) return;
      try {
        await this.writeState({ version: 1, leases: nextLeases }, sha);
        return;
      } catch (error) {
        if (!conflict(error) || attempt === 2) throw error;
      }
    }
    throw new Error("lease release could not be committed");
  }
}
