import { GitHubApiError } from "./github-client.mjs";
import { canTransition, JOB_STATUSES } from "../domain/job.mjs";

const JOB_ID = /^job_[A-Za-z0-9-]{1,100}$/;
const TERMINAL_STATUSES = new Set(["succeeded", "failed"]);

function conflict(error) {
  return error instanceof GitHubApiError && (error.status === 409 || error.status === 422);
}

function canonicalTimestamp(value) {
  if (typeof value !== "string") return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function jobStatePath(jobId) {
  if (typeof jobId !== "string" || !JOB_ID.test(jobId)) throw new Error("job id is invalid");
  return `.prompthub/jobs/${jobId}.json`;
}

function validateState(state, jobId) {
  if (!state || typeof state !== "object" || Array.isArray(state)
    || state.version !== 2 || state.job_id !== jobId || !JOB_STATUSES.includes(state.status)
    || !Number.isSafeInteger(state.revision) || state.revision < 1
    || !Number.isSafeInteger(state.status_revision) || state.status_revision < 1 || state.status_revision > state.revision
    || !Number.isSafeInteger(state.generation) || state.generation < 0
    || !Number.isSafeInteger(state.issue_number) || state.issue_number < 1
    || !canonicalTimestamp(state.requested_at) || !canonicalTimestamp(state.updated_at)) {
    throw new Error("job state is invalid; refusing to overwrite it");
  }
  if (state.status === "running") {
    if (!Number.isSafeInteger(state.generation) || state.generation < 1
      || typeof state.runner_id !== "string" || state.runner_id.length === 0 || state.runner_id.length > 200
      || !canonicalTimestamp(state.lease_expires_at)) {
      throw new Error("running job state has no valid fencing lease; refusing to overwrite it");
    }
  } else if (state.runner_id !== null || state.lease_expires_at !== null) {
    throw new Error("non-running job state contains an active lease; refusing to overwrite it");
  }
  if (!state.required_checks || typeof state.required_checks !== "object" || Array.isArray(state.required_checks)
    || typeof state.required_checks.passed !== "boolean" || !Array.isArray(state.required_checks.names)
    || state.required_checks.names.some((name) => typeof name !== "string" || name.length > 200)
    || (state.completion !== null && (!state.completion || typeof state.completion !== "object" || Array.isArray(state.completion)))) {
    throw new Error("job state result data is invalid; refusing to overwrite it");
  }
  if (TERMINAL_STATUSES.has(state.status)) {
    const completion = state.completion;
    if (!completion || completion.status !== state.status || !Number.isSafeInteger(completion.generation)
      || completion.generation < 1 || completion.generation !== state.generation
      || typeof completion.runner_id !== "string" || completion.runner_id.length === 0
      || !canonicalTimestamp(completion.completed_at)
      || (state.status === "succeeded" && state.required_checks.passed !== true)) {
      throw new Error("terminal job state has no matching verified completion; refusing to overwrite it");
    }
  }
  if (state.status === "running" && state.completion !== null) {
    throw new Error("running job state contains a prior completion; refusing to overwrite it");
  }
  if (state.checkpoint !== null && (!state.checkpoint || typeof state.checkpoint !== "object" || Array.isArray(state.checkpoint))) {
    throw new Error("job state checkpoint is invalid; refusing to overwrite it");
  }
  if (state.resource_metrics !== null && (!state.resource_metrics || typeof state.resource_metrics !== "object" || Array.isArray(state.resource_metrics))) {
    throw new Error("job state resource metrics are invalid; refusing to overwrite it");
  }
  if (state.last_decision !== undefined && (!state.last_decision || typeof state.last_decision !== "object" || Array.isArray(state.last_decision)
    || typeof state.last_decision.actor !== "string" || !canonicalTimestamp(state.last_decision.at)
    || !JOB_STATUSES.includes(state.last_decision.status))) {
    throw new Error("job state decision record is invalid; refusing to overwrite it");
  }
}

export class GitHubJobStateStore {
  constructor({ client, repository, branch = "main", now = () => new Date() } = {}) {
    this.client = client;
    this.repository = repository;
    this.branch = branch;
    this.now = now;
  }

  async read(jobId, { ref = this.branch } = {}) {
    const path = jobStatePath(jobId);
    const file = await this.client.getContent(this.repository, path, ref);
    if (!file) return null;
    let state;
    try {
      state = JSON.parse(file.content);
    } catch {
      throw new Error("job state JSON is invalid; refusing to overwrite it");
    }
    validateState(state, jobId);
    if (typeof file.sha !== "string" || file.sha.length === 0) throw new Error("job state revision is unavailable; refusing to overwrite it");
    return { state, sha: file.sha, path };
  }

  async get(jobId, { ref = this.branch } = {}) {
    const record = await this.read(jobId, { ref });
    return record ? structuredClone(record.state) : null;
  }

  async listAll({ allowUninitialized = false } = {}) {
    let entries;
    let snapshotRef = this.branch;
    try {
      entries = await this.client.listContents(this.repository, ".prompthub/jobs", this.branch);
    } catch (error) {
      if (error instanceof GitHubApiError && error.status === 404 && allowUninitialized) return [];
      if (error instanceof GitHubApiError && error.status === 404) {
        throw new Error("canonical job-state directory is missing after initialization; refusing to operate");
      }
      throw error;
    }
    if (!Array.isArray(entries)) throw new Error("canonical job-state directory is invalid; refusing to operate");
    if (entries.length === 1000) {
      if (typeof this.client.listTreeDirectory !== "function") {
        throw new Error("canonical job-state directory may be truncated; refusing to operate");
      }
      const treeListing = await this.client.listTreeDirectory(this.repository, ".prompthub/jobs", this.branch);
      if (!treeListing || typeof treeListing !== "object" || !Array.isArray(treeListing.entries)
        || typeof treeListing.ref !== "string" || treeListing.ref.length === 0) {
        throw new Error("canonical job-state tree is invalid; refusing to operate");
      }
      entries = treeListing.entries;
      snapshotRef = treeListing.ref;
    }
    const jobIds = entries.map((entry) => {
      const match = entry?.type === "file" && typeof entry.name === "string"
        ? /^(job_[A-Za-z0-9-]{1,100})\.json$/.exec(entry.name)
        : null;
      if (!match) throw new Error("canonical job-state directory contains an unexpected entry; refusing to operate");
      return match[1];
    });
    if (new Set(jobIds).size !== jobIds.length) throw new Error("canonical job-state directory contains duplicate job IDs");
    const states = await Promise.all(jobIds.map(async (jobId) => {
      const state = await this.get(jobId, { ref: snapshotRef });
      if (!state) throw new Error("canonical job state disappeared during directory read; refusing to operate");
      return state;
    }));
    return states;
  }

  async create(job) {
    const path = jobStatePath(job.id);
    const state = {
      version: 2,
      revision: 1,
      status_revision: 1,
      job_id: job.id,
      status: job.status,
      generation: 0,
      runner_id: null,
      lease_expires_at: null,
      issue_number: job.issue_number,
      requested_at: job.requested_at,
      updated_at: this.now().toISOString(),
      required_checks: job.required_checks ?? { passed: false, names: [] },
      resource_metrics: job.resource_metrics ?? null,
      checkpoint: job.checkpoint ?? null,
      completion: null,
      ...(job.last_decision ? { last_decision: job.last_decision } : {}),
    };
    validateState(state, job.id);
    try {
      await this.client.putContent(this.repository, path, {
        content: `${JSON.stringify(state, null, 2)}\n`,
        branch: this.branch,
        message: `chore(prompthub): initialize state for ${job.id}`,
      });
      return structuredClone(state);
    } catch (error) {
      if (!conflict(error)) throw error;
      const existing = await this.get(job.id);
      if (existing?.issue_number === job.issue_number) return existing;
      throw new Error("job state already exists with a different issue binding");
    }
  }

  async mutate(jobId, update) {
    const path = jobStatePath(jobId);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const record = await this.read(jobId);
      if (!record) throw new Error("job state not found");
      const next = update(structuredClone(record.state));
      if (next === null) return null;
      if (JSON.stringify(next) === JSON.stringify(record.state)) return structuredClone(record.state);
      next.revision = record.state.revision + 1;
      validateState(next, jobId);
      try {
        await this.client.putContent(this.repository, path, {
          content: `${JSON.stringify(next, null, 2)}\n`,
          sha: record.sha,
          branch: this.branch,
          message: `chore(prompthub): update state for ${jobId}`,
        });
        return structuredClone(next);
      } catch (error) {
        if (!conflict(error) || attempt === 2) throw error;
      }
    }
    throw new Error("job state could not be committed");
  }

  async claim(jobId, lease) {
    if (lease?.job_id !== jobId || typeof lease.runner_id !== "string" || !Number.isSafeInteger(lease.generation) || lease.generation < 1
      || !canonicalTimestamp(lease.expires_at) || Date.parse(lease.expires_at) <= this.now().getTime()) {
      throw new Error("claim lease is invalid");
    }
    return this.mutate(jobId, (state) => {
      if (state.status !== "queued") return null;
      if (lease.generation <= state.generation) throw new Error("claim fencing generation is stale");
      return {
        ...state,
        status: "running",
        status_revision: state.status_revision + 1,
        generation: lease.generation,
        runner_id: lease.runner_id,
        lease_expires_at: lease.expires_at,
        required_checks: { passed: false, names: [] },
        completion: null,
        updated_at: this.now().toISOString(),
      };
    });
  }

  async assertOwner(jobId, runnerId, generation, { requireUnexpired = true } = {}) {
    const state = await this.get(jobId);
    if (!state || state.status !== "running" || state.runner_id !== runnerId || state.generation !== generation
      || (requireUnexpired && Date.parse(state.lease_expires_at) <= this.now().getTime())) {
      throw new Error("active job state owner not found");
    }
    return state;
  }

  async heartbeat(jobId, lease) {
    return this.mutate(jobId, (state) => {
      const now = this.now();
      if (state.status !== "running" || state.runner_id !== lease.runner_id || state.generation !== lease.generation
        || Date.parse(state.lease_expires_at) <= now.getTime() || Date.parse(lease.expires_at) <= now.getTime()) {
        throw new Error("active job state owner not found");
      }
      return { ...state, lease_expires_at: lease.expires_at, updated_at: now.toISOString() };
    });
  }

  async checkpoint(jobId, lease, checkpoint) {
    return this.mutate(jobId, (state) => {
      const now = this.now();
      if (state.status !== "running" || state.runner_id !== lease.runner_id || state.generation !== lease.generation
        || Date.parse(state.lease_expires_at) <= now.getTime() || Date.parse(lease.expires_at) <= now.getTime()) {
        throw new Error("active job state owner not found");
      }
      return {
        ...state,
        lease_expires_at: lease.expires_at,
        checkpoint,
        updated_at: now.toISOString(),
      };
    });
  }

  async complete(jobId, lease, status, details = {}) {
    if (!TERMINAL_STATUSES.has(status)) throw new Error("job completion status is invalid");
    if (status === "succeeded" && details.requiredChecks?.passed !== true) {
      throw new Error("succeeded requires passing required checks");
    }
    return this.mutate(jobId, (state) => {
      if (TERMINAL_STATUSES.has(state.status)) {
        if (state.completion?.runner_id === lease.runner_id && state.completion?.generation === lease.generation && state.completion?.status === status) return state;
        throw new Error("job already completed by another lease generation");
      }
      const now = this.now();
      if (state.status !== "running" || state.runner_id !== lease.runner_id || state.generation !== lease.generation
        || Date.parse(state.lease_expires_at) <= now.getTime()) {
        throw new Error("active job state owner not found");
      }
      return {
        ...state,
        status,
        status_revision: state.status_revision + 1,
        runner_id: null,
        lease_expires_at: null,
        required_checks: details.requiredChecks ?? { passed: false, names: [] },
        resource_metrics: details.resourceMetrics ?? state.resource_metrics ?? null,
        completion: {
          id: `${jobId}:${lease.generation}:${status}`,
          status,
          runner_id: lease.runner_id,
          generation: lease.generation,
          completed_at: now.toISOString(),
        },
        updated_at: now.toISOString(),
      };
    });
  }

  async transition(jobId, { expectedStatuses, status, actor, reason = null }) {
    if (!Array.isArray(expectedStatuses) || expectedStatuses.some((item) => !JOB_STATUSES.includes(item))
      || !JOB_STATUSES.includes(status) || typeof actor !== "string" || actor.trim().length === 0
      || (reason !== null && typeof reason !== "string")) {
      throw new Error("job transition request is invalid");
    }
    return this.mutate(jobId, (state) => {
      if (!expectedStatuses.includes(state.status) || !canTransition(state.status, status)) return null;
      const now = this.now().toISOString();
      return {
        ...state,
        status,
        status_revision: state.status_revision + 1,
        runner_id: null,
        lease_expires_at: null,
        completion: state.completion,
        last_decision: { actor, reason, at: now, status },
        updated_at: now,
      };
    });
  }

  async markStale(jobId, { generation, reason = "runner_lease_expired", allowUnexpired = false } = {}) {
    return this.mutate(jobId, (state) => {
      const now = this.now();
      if (state.status !== "running" || state.generation !== generation
        || (!allowUnexpired && Date.parse(state.lease_expires_at) > now.getTime())) return null;
      return {
        ...state,
        status: "stale",
        status_revision: state.status_revision + 1,
        runner_id: null,
        lease_expires_at: null,
        last_decision: { actor: "system", reason, at: now.toISOString(), status: "stale" },
        updated_at: now.toISOString(),
      };
    });
  }
}
