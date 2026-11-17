import { createEvent, createJob, JOB_STATUSES, publicJob, STATUS_LABELS } from "../domain/job.mjs";
import { GitHubJobStateStore } from "./github-job-state-store.mjs";
import { GitHubLeaseStore } from "./github-lease-store.mjs";
import { decodeBase64Url, encodeBase64Url } from "../security/web-crypto.mjs";

const JOB_MARKER = /<!--\s*prompthub-job:v1\s+([A-Za-z0-9_-]+)\s*-->/;
const EVENT_MARKER = /<!--\s*prompthub-event:v1\s+([A-Za-z0-9_-]+)\s*-->/;
const STATUS_LABEL_SET = new Set(Object.values(STATUS_LABELS));
function encode(value) {
  return encodeBase64Url(JSON.stringify(value));
}

function decode(value) {
  return JSON.parse(decodeBase64Url(value));
}

function statusFromLabels(labels = []) {
  const found = labels.map((label) => typeof label === "string" ? label : label.name).find((name) => STATUS_LABEL_SET.has(name));
  return Object.entries(STATUS_LABELS).find(([, label]) => label === found)?.[0] ?? "stale";
}

function eventForState(job, state, { type, phase, summary, ruleVersion = "local" }) {
  const event = createEvent({ jobId: job.id, type, phase, status: state.status, summary, now: new Date(state.updated_at), ruleVersion });
  const transitionRevision = state.completion?.generation ?? (state.status === "running" ? state.generation : state.status_revision);
  const safeJobId = job.id.replace(/[^A-Za-z0-9-]/g, "-").slice(0, 60);
  event.event_id = `evt_${safeJobId}-${transitionRevision}-${type}`;
  return event;
}

export class GitHubControlPlane {
  constructor({ client, repository, branch = "main", leasePath, leaseTtlMs, maxActiveJobs = 2, requirePrivate = true, now = () => new Date(), ruleVersion = "local" } = {}) {
    this.client = client;
    this.repository = repository;
    this.branch = branch;
    this.now = now;
    this.ruleVersion = ruleVersion;
    this.leaseStore = new GitHubLeaseStore({ client, repository, branch, path: leasePath, ttlMs: leaseTtlMs, maxActiveJobs, now });
    this.jobStateStore = new GitHubJobStateStore({ client, repository, branch, now });
    this.requirePrivate = requirePrivate;
  }

  async assertRepositorySafety() {
    const repo = await this.client.getRepository(this.repository);
    if (this.requirePrivate && repo.private !== true) {
      throw new Error("configured GitHub control repository must be private");
    }
    return repo;
  }

  async ensureStatusLabel(label) {
    const labels = await this.client.listLabels(this.repository);
    if (!labels.some((item) => item.name === label)) {
      try {
        await this.client.createLabel(this.repository, { name: label });
      } catch (error) {
        if (!(error?.status === 422)) throw error;
      }
    }
  }

  serializeJob(job) {
    const metadata = {
      schema: 1,
      id: job.id,
      prompt: job.prompt,
      project: job.project,
      base_ref: job.base_ref,
      priority: job.priority,
      requested_at: job.requested_at,
      status: job.status,
      status_revision: job.status_revision ?? job.ledger_status_revision ?? 0,
      requires_approval: job.status === "awaiting_approval",
      depends_on: job.depends_on,
      risk: job.risk,
      resource_metrics: job.resource_metrics ?? null,
    };
    return [
      "PromptHub Studio job. Machine-readable metadata follows; do not execute issue text as commands.",
      "",
      `<!-- prompthub-job:v1 ${encode(metadata)} -->`,
    ].join("\n");
  }

  normalizeIssue(issue) {
    if (issue.pull_request) return null;
    const match = JOB_MARKER.exec(issue.body ?? "");
    if (!match) return null;
    let metadata;
    try {
      metadata = decode(match[1]);
    } catch {
      return null;
    }
    if (metadata.schema !== 1 || typeof metadata.id !== "string" || typeof metadata.prompt !== "string") return null;
    return {
      id: metadata.id,
      prompt: metadata.prompt,
      project: metadata.project,
      base_ref: metadata.base_ref,
      priority: metadata.priority,
      depends_on: Array.isArray(metadata.depends_on) ? metadata.depends_on : [],
      risk: metadata.risk ?? "medium",
      status: statusFromLabels(issue.labels),
      projected_status: statusFromLabels(issue.labels),
      projected_status_revision: Number.isSafeInteger(metadata.status_revision) ? metadata.status_revision : 0,
      requested_at: metadata.requested_at,
      updated_at: issue.updated_at ?? issue.created_at,
      required_checks: { passed: false, names: [] },
      resource_metrics: metadata.resource_metrics ?? null,
      checkpoint: null,
      events: [],
      issue_number: issue.number,
      issue_url: issue.html_url,
    };
  }

  applyCanonicalState(job, state) {
    return {
      ...job,
      status: state.status,
      updated_at: state.updated_at,
      ledger_revision: state.revision,
      status_revision: state.status_revision,
      required_checks: structuredClone(state.required_checks),
      resource_metrics: state.resource_metrics ?? null,
      checkpoint: state.checkpoint ?? null,
    };
  }

  async hydrateIssue(issue) {
    const job = this.normalizeIssue(issue);
    if (!job) return null;
    let state = await this.jobStateStore.get(job.id);
    if (!state) {
      await this.leaseStore.markJobsInitialized();
      state = await this.jobStateStore.create({
        ...job,
        status: "stale",
        required_checks: { passed: false, names: [] },
        resource_metrics: null,
        checkpoint: null,
        last_decision: {
          actor: "system",
          reason: "legacy_issue_status_imported_for_reconciliation",
          at: this.now().toISOString(),
          status: "stale",
        },
      });
    }
    return this.applyCanonicalState(job, state);
  }

  async createJob(input, { id } = {}) {
    if (id) {
      const existing = await this.findJob(id);
      if (existing) return this.getJob(id);
    }
    await this.leaseStore.assertJobInitializationAllowed();
    await this.ensureStatusLabel(STATUS_LABELS[input.requiresApproval ? "awaiting_approval" : "queued"]);
    const job = createJob(input, { now: this.now(), ...(id ? { id } : {}) });
    const issue = await this.client.createIssue(this.repository, {
      title: `PromptHub job ${job.id}`,
      body: this.serializeJob(job),
      labels: [STATUS_LABELS[job.status]],
    });
    job.issue_number = issue.number;
    job.issue_url = issue.html_url;
    await this.leaseStore.markJobsInitialized();
    const state = await this.jobStateStore.create(job);
    await this.appendEvent(job, eventForState(job, state, {
      type: "created",
      phase: "intake",
      summary: "Job accepted by the control plane",
      ruleVersion: this.ruleVersion,
    }));
    return structuredClone(job);
  }

  async loadJobs({ state = "all" } = {}) {
    const issues = await this.client.listIssues(this.repository, { state });
    const jobs = await Promise.all(issues.map((issue) => this.hydrateIssue(issue)));
    return jobs.filter(Boolean);
  }

  async listJobs({ state = "all", labels } = {}) {
    const jobs = await this.loadJobs({ state });
    const requestedStatus = typeof labels === "string"
      ? Object.entries(STATUS_LABELS).find(([, label]) => label === labels)?.[0]
      : null;
    return jobs.filter((job) => !requestedStatus || job.status === requestedStatus).map((job) => publicJob(job));
  }

  async listQueuedJobs() {
    const jobs = await this.loadJobs({ state: "all" });
    const statuses = new Map(jobs.map((job) => [job.id, job.status]));
    return jobs.filter((job) => job.status === "queued" && job.depends_on.every((dependency) => statuses.get(dependency) === "succeeded"));
  }

  async recoverStaleJobs() {
    const jobs = await this.loadJobs({ state: "all" });
    const leaseSnapshot = await this.leaseStore.readState();
    if (leaseSnapshot.missing) throw new Error("lease ledger is missing; refusing automatic recovery");
    if (leaseSnapshot.legacySchema && leaseSnapshot.state.leases.length > 0) {
      throw new Error("legacy lease ledger contains unfenced leases; refusing automatic recovery");
    }
    const { state: leases } = leaseSnapshot;
    const active = new Map(this.leaseStore.activeLeases(leases).map((lease) => [lease.job_id, lease]));
    const jobsById = new Map(jobs.map((job) => [job.id, job]));
    const states = await this.jobStateStore.listAll({ allowUninitialized: !leaseSnapshot.state.jobs_initialized });
    if (leaseSnapshot.legacySchema && states.some((state) => state.status === "running")) {
      throw new Error("legacy lease ledger cannot fence canonical running jobs; refusing automatic recovery");
    }
    for (const state of states) {
      const job = jobsById.get(state.job_id);
      const lease = active.get(state.job_id);
      if (state.status === "running") {
        if (!job) throw new Error("running canonical job has no GitHub issue; refusing automatic recovery");
        if (lease && lease.runner_id === state.runner_id && lease.generation === state.generation) continue;
        if (lease) {
          throw new Error("job state and active lease generations conflict; refusing automatic recovery");
        }
        const recovered = await this.jobStateStore.markStale(state.job_id, {
          generation: state.generation,
          allowUnexpired: true,
          reason: "runner_lease_missing_or_expired",
        });
        if (!recovered) continue;
        jobsById.set(state.job_id, this.applyCanonicalState(job, recovered));
        continue;
      }
      if (["succeeded", "failed"].includes(state.status) && lease) {
        if (lease.generation !== state.completion?.generation || lease.runner_id !== state.completion?.runner_id) {
          throw new Error("terminal job state conflicts with an active lease generation; refusing automatic release");
        }
        await this.leaseStore.release(state.job_id, lease.runner_id, lease.generation);
        active.delete(state.job_id);
      } else if (state.status !== "running" && !job && lease && ["queued", "awaiting_approval"].includes(state.status)) {
        throw new Error("active job lease has no GitHub issue projection; refusing automatic recovery");
      }
    }
    const reconciledJobs = [...jobsById.values()];
    await this.reconcileProjections(reconciledJobs);
  }

  async assertRunningJobsHaveLeases() {
    const jobs = await this.loadJobs({ state: "all" });
    const leaseSnapshot = await this.leaseStore.readState();
    if (leaseSnapshot.missing) throw new Error("lease ledger is missing; refusing a new claim");
    if (leaseSnapshot.legacySchema && leaseSnapshot.state.leases.length > 0) {
      throw new Error("legacy lease ledger contains unfenced leases; refusing a new claim");
    }
    const active = new Map(this.leaseStore.activeLeases(leaseSnapshot.state).map((lease) => [lease.job_id, lease]));
    const projectedJobIds = new Set(jobs.map((job) => job.id));
    const states = await this.jobStateStore.listAll({ allowUninitialized: !leaseSnapshot.state.jobs_initialized });
    if (leaseSnapshot.legacySchema && states.some((state) => state.status === "running")) {
      throw new Error("legacy lease ledger cannot fence canonical running jobs; refusing a new claim");
    }
    for (const state of states) {
      if (state.status !== "running") continue;
      if (!projectedJobIds.has(state.job_id)) {
        throw new Error("canonical running job has no GitHub issue; refusing a new claim");
      }
      const lease = active.get(state.job_id);
      if (!lease || lease.runner_id !== state.runner_id || lease.generation !== state.generation) {
        throw new Error("canonical running job has no matching active lease; refusing a new claim");
      }
    }
  }

  async findJob(jobId) {
    const issues = await this.client.listIssues(this.repository, { state: "all" });
    const issue = issues.find((item) => this.normalizeIssue(item)?.id === jobId);
    return issue ? this.hydrateIssue(issue) : null;
  }

  async getJob(jobId) {
    const job = await this.findJob(jobId);
    if (!job) return null;
    const comments = await this.client.listIssueComments(this.repository, job.issue_number);
    const uniqueEvents = new Map();
    const eventsWithoutId = [];
    for (const comment of comments) {
      const event = this.parseEvent(comment.body);
      if (!event) continue;
      if (typeof event.event_id !== "string") eventsWithoutId.push(event);
      else if (!uniqueEvents.has(event.event_id)) uniqueEvents.set(event.event_id, event);
    }
    job.events = [...uniqueEvents.values(), ...eventsWithoutId];
    return publicJob(job);
  }

  parseEvent(body = "") {
    const match = EVENT_MARKER.exec(body);
    if (!match) return null;
    try {
      return decode(match[1]);
    } catch {
      return null;
    }
  }

  async appendEvent(job, event) {
    const comments = await this.client.listIssueComments(this.repository, job.issue_number);
    if (comments.some((comment) => this.parseEvent(comment.body)?.event_id === event.event_id)) return;
    const payload = encode(event);
    await this.client.createIssueComment(this.repository, job.issue_number, `<!-- prompthub-event:v1 ${payload} -->\n${event.summary}`);
  }

  async projectStatus(job, status, resourceMetrics = job.resource_metrics ?? null, expectedRevision = job.ledger_revision) {
    if (!JOB_STATUSES.includes(status)) throw new Error(`unknown job status: ${status}`);
    const canonical = await this.jobStateStore.get(job.id);
    if (!canonical || canonical.status !== status || (expectedRevision !== null && expectedRevision !== undefined && canonical.revision !== expectedRevision)) {
      return false;
    }
    await this.ensureStatusLabel(STATUS_LABELS[status]);
    const issue = await this.client.request(`/repos/${this.repository}/issues/${job.issue_number}`);
    const labels = (issue.labels ?? []).map((label) => typeof label === "string" ? label : label.name).filter((label) => !STATUS_LABEL_SET.has(label));
    const next = { ...job, status, status_revision: canonical.status_revision, resource_metrics: resourceMetrics };
    await this.client.updateIssue(this.repository, job.issue_number, { labels: [...labels, STATUS_LABELS[status]], body: this.serializeJob(next) });
    return true;
  }

  canonicalEvent(job, state) {
    if (state.completion) {
      const event = eventForState(job, state, {
        type: "completed",
        phase: "result",
        summary: state.status === "succeeded" ? "Required checks passed" : `Job ended with status ${state.status}`,
        ruleVersion: this.ruleVersion,
      });
      event.required_checks = state.required_checks;
      if (state.resource_metrics) event.resource_metrics = state.resource_metrics;
      return event;
    }
    if (state.status === "running") return eventForState(job, state, {
      type: "claimed", phase: "runner", summary: `Claimed by runner ${state.runner_id}`, ruleVersion: this.ruleVersion,
    });
    if (state.last_decision) {
      const type = state.status === "paused" ? "paused"
        : state.status === "stale" ? "stale"
          : state.last_decision.reason === "approve" ? "approved" : "resumed";
      return eventForState(job, state, {
        type,
        phase: type === "paused" ? "approval" : type === "stale" ? "recovery" : "approval",
        summary: state.last_decision.reason
          ? `${type} by ${state.last_decision.actor}: ${state.last_decision.reason}`
          : `${type} by ${state.last_decision.actor}`,
        ruleVersion: this.ruleVersion,
      });
    }
    return eventForState(job, state, { type: "created", phase: "intake", summary: "Job accepted by the control plane", ruleVersion: this.ruleVersion });
  }

  async reconcileProjections(jobs) {
    for (const job of jobs) {
      const state = await this.jobStateStore.get(job.id);
      if (!state) throw new Error("canonical job state disappeared during projection repair");
      if (job.projected_status !== state.status || job.projected_status_revision !== state.status_revision) {
        await this.projectStatus(this.applyCanonicalState(job, state), state.status, state.resource_metrics, state.revision);
      }
      await this.appendEvent(job, this.canonicalEvent(job, state));
    }
  }

  async claimJob(jobId, runnerId) {
    const job = await this.findJob(jobId);
    if (!job || job.status !== "queued") return null;
    const priorState = await this.jobStateStore.get(jobId);
    if (!priorState || priorState.status !== "queued") return null;
    await this.assertRunningJobsHaveLeases();
    const lease = await this.leaseStore.acquire(jobId, runnerId, { minGeneration: priorState.generation + 1 });
    if (!lease) return null;
    try {
      const state = await this.jobStateStore.claim(jobId, lease);
      if (!state) {
        await this.leaseStore.release(jobId, runnerId, lease.generation);
        return null;
      }
      const claimed = this.applyCanonicalState(job, state);
      await this.projectStatus(claimed, state.status, state.resource_metrics, state.revision);
      await this.appendEvent(claimed, eventForState(claimed, state, {
        type: "claimed",
        phase: "runner",
        summary: `Claimed by runner ${runnerId}`,
        ruleVersion: this.ruleVersion,
      }));
      return { ...claimed, lease_generation: lease.generation };
    } catch (error) {
      await this.leaseStore.release(jobId, runnerId, lease.generation).catch(() => {});
      throw error;
    }
  }

  async heartbeat(jobId, runnerId, phase = "running", generation = null) {
    const lease = await this.leaseStore.heartbeat(jobId, runnerId, generation);
    const state = await this.jobStateStore.heartbeat(jobId, lease);
    const job = await this.findJob(jobId);
    if (job) {
      const event = createEvent({ jobId, type: "heartbeat", phase, status: state.status, summary: "Runner heartbeat received", now: this.now(), ruleVersion: this.ruleVersion });
      await this.appendEvent(job, event);
    }
    return state;
  }

  async checkpoint(jobId, runnerId, checkpoint, generation = null) {
    const lease = await this.leaseStore.heartbeat(jobId, runnerId, generation);
    const safe = {
      phase: String(checkpoint.phase ?? "unknown").slice(0, 120),
      summary: String(checkpoint.summary ?? "checkpoint").slice(0, 1000),
      ref: checkpoint.ref ? String(checkpoint.ref).slice(0, 200) : null,
      created_at: this.now().toISOString(),
    };
    const state = await this.jobStateStore.checkpoint(jobId, lease, safe);
    const job = await this.findJob(jobId);
    if (!job) throw new Error("job not found");
    const event = createEvent({ jobId, type: "checkpoint", phase: safe.phase, status: state.status, summary: safe.summary, refs: safe.ref ? [safe.ref] : [], now: this.now(), ruleVersion: this.ruleVersion });
    event.checkpoint = safe;
    await this.appendEvent(job, event);
    return state;
  }

  async completeJob(jobId, runnerId, status, details = {}, generation = null) {
    const priorState = await this.jobStateStore.get(jobId);
    if (priorState && ["succeeded", "failed"].includes(priorState.status)) {
      if (priorState.completion?.runner_id === runnerId && priorState.completion?.status === status
        && (generation === null || priorState.completion?.generation === generation)) {
        return this.findJob(jobId);
      }
      throw new Error("job already completed by another lease generation");
    }
    const lease = await this.leaseStore.getActiveLease(jobId, runnerId, generation);
    const job = await this.findJob(jobId);
    if (!job) throw new Error("job not found");
    const completed = await this.jobStateStore.complete(jobId, lease, status, details);
    await this.leaseStore.release(jobId, runnerId, lease.generation);
    const updated = this.applyCanonicalState(job, completed);
    await this.projectStatus(updated, completed.status, completed.resource_metrics, completed.revision);
    await this.appendEvent(updated, this.canonicalEvent(updated, completed));
    return updated;
  }

  async approveJob(jobId, actor, decision) {
    const job = await this.findJob(jobId);
    if (!job) throw new Error("job not found");
    const allowed = {
      awaiting_approval: { approve: "queued", pause: "paused" },
      stale: { resume: "queued", pause: "paused" },
      paused: { resume: "queued", pause: "paused" },
    };
    const resolvedStatus = allowed[job.status]?.[decision];
    if (!resolvedStatus) throw new Error(job.status === "awaiting_approval" ? "decision must be approve or pause" : "decision must be resume or pause");
    let state = await this.jobStateStore.transition(jobId, {
      expectedStatuses: [job.status],
      status: resolvedStatus,
      actor,
      reason: decision,
    });
    if (!state) {
      const current = await this.jobStateStore.get(jobId);
      if (current?.status === resolvedStatus && current.last_decision?.actor === actor && current.last_decision?.reason === decision) state = current;
      else throw new Error("job state changed before the approval decision could be committed");
    }
    const updated = this.applyCanonicalState(job, state);
    await this.projectStatus(updated, state.status, state.resource_metrics, state.revision);
    await this.appendEvent(updated, eventForState(updated, state, {
      type: state.status === "paused" ? "paused" : job.status === "awaiting_approval" ? "approved" : "resumed",
      phase: "approval",
      summary: `${state.status === "paused" ? "Paused" : job.status === "awaiting_approval" ? "Approved" : "Resumed"} by ${actor}`,
      ruleVersion: this.ruleVersion,
    }));
    return this.getJob(jobId);
  }

  async pauseJob(jobId, actor, reason = "Paused by user") {
    const job = await this.findJob(jobId);
    if (!job || !["queued", "awaiting_approval", "stale"].includes(job.status)) {
      throw new Error("job cannot be safely paused in its current state");
    }
    const state = await this.jobStateStore.transition(jobId, {
      expectedStatuses: [job.status],
      status: "paused",
      actor,
      reason,
    });
    if (!state) throw new Error("job state changed before it could be paused");
    const updated = this.applyCanonicalState(job, state);
    await this.projectStatus(updated, state.status, state.resource_metrics, state.revision);
    await this.appendEvent(updated, eventForState(updated, state, {
      type: "paused",
      phase: "project-removal",
      summary: `${reason} by ${actor}`,
      ruleVersion: this.ruleVersion,
    }));
    return this.getJob(jobId);
  }
}
