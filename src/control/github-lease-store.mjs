import { GitHubApiError } from "./github-client.mjs";

function emptyState() {
  return { version: 2, next_generation: 1, jobs_initialized: false, leases: [] };
}

function isConflict(error) {
  return error instanceof GitHubApiError && (error.status === 409 || error.status === 422);
}

function isCanonicalTimestamp(value) {
  if (typeof value !== "string") return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function validateLeases(leases, { legacy = false } = {}) {
  const jobIds = new Set();
  const generations = new Set();
  for (const lease of leases) {
    const acquiredAt = Date.parse(lease?.acquired_at ?? "");
    const heartbeatAt = Date.parse(lease?.heartbeat_at ?? "");
    const expiresAt = Date.parse(lease?.expires_at ?? "");
    if (!lease || typeof lease !== "object" || Array.isArray(lease)
      || typeof lease.job_id !== "string" || !/^job_[A-Za-z0-9-]{1,100}$/.test(lease.job_id)
      || typeof lease.runner_id !== "string" || lease.runner_id.length < 1 || lease.runner_id.length > 200
      || (legacy
        ? lease.generation !== undefined
        : (!Number.isSafeInteger(lease.generation) || lease.generation < 1 || generations.has(lease.generation)))
      || !isCanonicalTimestamp(lease.acquired_at)
      || !isCanonicalTimestamp(lease.heartbeat_at)
      || !isCanonicalTimestamp(lease.expires_at)
      || heartbeatAt < acquiredAt || expiresAt <= heartbeatAt || jobIds.has(lease.job_id)) {
      throw new Error("active-jobs.json contains an invalid lease; refusing to overwrite it");
    }
    jobIds.add(lease.job_id);
    if (!legacy) generations.add(lease.generation);
  }
}

function normalizeState(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || !Array.isArray(raw.leases)) {
    throw new Error("active-jobs.json has an unsupported schema; refusing to overwrite it");
  }
  if (raw.version === 1) {
    validateLeases(raw.leases, { legacy: true });
    if (raw.leases.length > 0) return { version: 1, next_generation: 1, jobs_initialized: false, leases: structuredClone(raw.leases) };
    return emptyState();
  }
  if (raw.version !== 2 || !Number.isSafeInteger(raw.next_generation) || raw.next_generation < 1) {
    throw new Error("active-jobs.json has an unsupported schema; refusing to overwrite it");
  }
  if (raw.jobs_initialized !== undefined && typeof raw.jobs_initialized !== "boolean") {
    throw new Error("active-jobs.json initialization marker is invalid; refusing to overwrite it");
  }
  validateLeases(raw.leases);
  if (raw.leases.some((lease) => lease.generation >= raw.next_generation)) {
    throw new Error("active-jobs.json generation counter is invalid; refusing to overwrite it");
  }
  return { ...raw, jobs_initialized: raw.jobs_initialized ?? false };
}

export class GitHubLeaseStore {
  constructor({ client, repository, branch = "main", path = ".prompthub/active-jobs.json", now = () => new Date(), ttlMs = 120000, maxActiveJobs = 2 } = {}) {
    if (!Number.isSafeInteger(maxActiveJobs) || maxActiveJobs < 1 || maxActiveJobs > 2) {
      throw new Error("global active job cap must be between one and two");
    }
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
    if (!file) return { state: emptyState(), sha: null, missing: true, legacySchema: false };
    let parsed;
    try {
      parsed = JSON.parse(file.content);
    } catch {
      throw new Error("active-jobs.json is invalid; refusing to overwrite it");
    }
    const legacySchema = parsed.version === 1;
    const state = normalizeState(parsed);
    const active = this.activeLeases(state);
    if (active.length > this.maxActiveJobs) {
      throw new Error("active-jobs.json exceeds the global job cap; refusing to operate");
    }
    if (typeof file.sha !== "string" || file.sha.length === 0) {
      throw new Error("active-jobs.json revision is unavailable; refusing to overwrite it");
    }
    return { state, sha: file.sha, missing: false, legacySchema };
  }

  activeLeases(state) {
    const now = this.now().getTime();
    return state.leases.filter((lease) => Date.parse(lease.expires_at) > now);
  }

  async writeState(state, sha) {
    await this.client.putContent(this.repository, this.path, {
      content: `${JSON.stringify(state, null, 2)}\n`,
      sha,
      branch: this.branch,
      message: "chore(prompthub): update active job leases",
    });
  }

  async assertJobInitializationAllowed() {
    const { state, missing, legacySchema } = await this.readState();
    if (missing) throw new Error("lease ledger is missing; refusing job-state initialization");
    if (legacySchema && state.leases.length > 0) {
      throw new Error("legacy lease ledger contains unfenced leases; refusing automatic initialization");
    }
  }

  async markJobsInitialized() {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const { state, sha, legacySchema, missing } = await this.readState();
      if (missing) throw new Error("lease ledger is missing; refusing job-state initialization");
      if (legacySchema && state.leases.length > 0) {
        throw new Error("legacy lease ledger contains unfenced leases; refusing automatic initialization");
      }
      if (state.jobs_initialized) return;
      try {
        await this.writeState({ ...state, jobs_initialized: true }, sha);
        return;
      } catch (error) {
        if (!isConflict(error) || attempt === 2) throw error;
      }
    }
    throw new Error("job-state initialization could not be committed");
  }

  async acquire(jobId, runnerId, { minGeneration = 1 } = {}) {
    if (typeof jobId !== "string" || !/^job_[A-Za-z0-9-]{1,100}$/.test(jobId)) throw new Error("job id is invalid");
    if (typeof runnerId !== "string" || runnerId.length < 1 || runnerId.length > 200) throw new Error("runner id is invalid");
    if (!Number.isSafeInteger(minGeneration) || minGeneration < 1) throw new Error("minimum lease generation is invalid");
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const { state, sha, legacySchema } = await this.readState();
      if (legacySchema && state.leases.length > 0) {
        throw new Error("legacy lease ledger contains unfenced leases; refusing a new claim");
      }
      const active = this.activeLeases(state);
      if (active.some((lease) => lease.job_id === jobId) || active.length >= this.maxActiveJobs) return null;
      const now = this.now();
      const generation = Math.max(state.next_generation, minGeneration);
      const lease = {
        job_id: jobId,
        runner_id: runnerId,
        generation,
        acquired_at: now.toISOString(),
        heartbeat_at: now.toISOString(),
        expires_at: new Date(now.getTime() + this.ttlMs).toISOString(),
      };
      const next = {
        version: 2,
        next_generation: generation + 1,
        jobs_initialized: state.jobs_initialized,
        leases: [...active, lease],
      };
      try {
        await this.writeState(next, sha);
        return lease;
      } catch (error) {
        if (!isConflict(error) || attempt === 2) throw error;
      }
    }
    return null;
  }

  async getActiveLease(jobId, runnerId, generation = null) {
    const { state, legacySchema } = await this.readState();
    if (legacySchema) throw new Error("legacy active-job lease has no fencing generation; refusing runner operation");
    const lease = state.leases.find((item) => item.job_id === jobId);
    if (!lease || lease.runner_id !== runnerId
      || (generation !== null && lease.generation !== generation)
      || Date.parse(lease.expires_at) <= this.now().getTime()) {
      throw new Error("active lease not found");
    }
    return lease;
  }

  async heartbeat(jobId, runnerId, generation = null) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const { state, sha, legacySchema } = await this.readState();
      if (legacySchema) throw new Error("legacy active-job lease has no fencing generation; refusing runner operation");
      const index = state.leases.findIndex((lease) => lease.job_id === jobId && lease.runner_id === runnerId
        && (generation === null || lease.generation === generation));
      const now = this.now();
      if (index === -1 || Date.parse(state.leases[index].expires_at) <= now.getTime()) {
        throw new Error("active lease not found");
      }
      const nextLeases = state.leases.slice();
      nextLeases[index] = {
        ...nextLeases[index],
        heartbeat_at: now.toISOString(),
        expires_at: new Date(now.getTime() + this.ttlMs).toISOString(),
      };
      try {
        await this.writeState({ ...state, leases: nextLeases }, sha);
        return nextLeases[index];
      } catch (error) {
        if (!isConflict(error) || attempt === 2) throw error;
      }
    }
    throw new Error("lease heartbeat could not be committed");
  }

  async release(jobId, runnerId, generation = null) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const { state, sha, legacySchema } = await this.readState();
      if (legacySchema) throw new Error("legacy active-job lease has no fencing generation; refusing release");
      const nextLeases = state.leases.filter((lease) => !(lease.job_id === jobId && lease.runner_id === runnerId
        && (generation === null || lease.generation === generation)));
      if (nextLeases.length === state.leases.length) return;
      try {
        await this.writeState({ ...state, leases: nextLeases }, sha);
        return;
      } catch (error) {
        if (!isConflict(error) || attempt === 2) throw error;
      }
    }
    throw new Error("lease release could not be committed");
  }
}
