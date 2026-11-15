import { createEvent, createJob, JOB_STATUSES, publicJob, STATUS_LABELS, transitionJob } from "../domain/job.mjs";
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

export class GitHubControlPlane {
  constructor({ client, repository, branch = "main", leasePath, leaseTtlMs, maxActiveJobs = 2, requirePrivate = true, now = () => new Date(), ruleVersion = "local" } = {}) {
    this.client = client;
    this.repository = repository;
    this.branch = branch;
    this.now = now;
    this.ruleVersion = ruleVersion;
    this.leaseStore = new GitHubLeaseStore({ client, repository, branch, path: leasePath, ttlMs: leaseTtlMs, maxActiveJobs, now });
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

  async createJob(input, { id } = {}) {
    if (id) {
      const existing = await this.findJob(id);
      if (existing) return this.getJob(id);
    }
    await this.ensureStatusLabel(STATUS_LABELS[input.requiresApproval ? "awaiting_approval" : "queued"]);
    const job = createJob(input, { now: this.now(), ...(id ? { id } : {}) });
    const issue = await this.client.createIssue(this.repository, {
      title: `PromptHub job ${job.id}`,
      body: this.serializeJob(job),
      labels: [STATUS_LABELS[job.status]],
    });
    job.issue_number = issue.number;
    job.issue_url = issue.html_url;
    const event = createEvent({ jobId: job.id, type: "created", phase: "intake", status: job.status, summary: "Job accepted by the control plane", now: this.now(), ruleVersion: this.ruleVersion });
    await this.appendEvent(job, event);
    return structuredClone(job);
  }

  async listJobs({ state = "all", labels } = {}) {
    const issues = await this.client.listIssues(this.repository, { state, labels });
    return issues.map((issue) => this.normalizeIssue(issue)).filter(Boolean).map((job) => publicJob(job));
  }

  async listQueuedJobs() {
    const issues = await this.client.listIssues(this.repository, { state: "all" });
    const jobs = issues.map((issue) => this.normalizeIssue(issue)).filter(Boolean);
    const statuses = new Map(jobs.map((job) => [job.id, job.status]));
    return jobs.filter((job) => job.status === "queued" && job.depends_on.every((dependency) => statuses.get(dependency) === "succeeded"));
  }

  async recoverStaleJobs() {
    const { state } = await this.leaseStore.readState();
    const activeIds = new Set(this.leaseStore.activeLeases(state).map((lease) => lease.job_id));
    const issues = await this.client.listIssues(this.repository, { state: "open", labels: STATUS_LABELS.running });
    for (const issue of issues) {
      const job = this.normalizeIssue(issue);
      if (!job || activeIds.has(job.id)) continue;
      await this.setStatus(job, "stale");
      await this.appendEvent(job, createEvent({ jobId: job.id, type: "stale", phase: "recovery", status: "stale", summary: "Runner lease expired; human resume review required", now: this.now(), ruleVersion: this.ruleVersion }));
    }
  }

  async findJob(jobId) {
    const issues = await this.client.listIssues(this.repository, { state: "all" });
    const job = issues.map((issue) => this.normalizeIssue(issue)).find((item) => item?.id === jobId);
    return job ?? null;
  }

  async getJob(jobId) {
    const job = await this.findJob(jobId);
    if (!job) return null;
    const comments = await this.client.listIssueComments(this.repository, job.issue_number);
    job.events = comments.map((comment) => this.parseEvent(comment.body)).filter(Boolean);
    const checkpointEvent = [...job.events].reverse().find((event) => event.type === "checkpoint");
    if (checkpointEvent?.checkpoint) job.checkpoint = checkpointEvent.checkpoint;
    const completion = [...job.events].reverse().find((event) => event.type === "completed");
    if (completion?.required_checks) job.required_checks = completion.required_checks;
    if (completion?.resource_metrics) job.resource_metrics = completion.resource_metrics;
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
    const payload = encode(event);
    await this.client.createIssueComment(this.repository, job.issue_number, `<!-- prompthub-event:v1 ${payload} -->\n${event.summary}`);
  }

  async setStatus(job, status, resourceMetrics = job.resource_metrics ?? null) {
    if (!JOB_STATUSES.includes(status)) throw new Error(`unknown job status: ${status}`);
    await this.ensureStatusLabel(STATUS_LABELS[status]);
    const issue = await this.client.request(`/repos/${this.repository}/issues/${job.issue_number}`);
    const labels = (issue.labels ?? []).map((label) => typeof label === "string" ? label : label.name).filter((label) => !STATUS_LABEL_SET.has(label));
    const next = { ...job, status, resource_metrics: resourceMetrics };
    await this.client.updateIssue(this.repository, job.issue_number, { labels: [...labels, STATUS_LABELS[status]], body: this.serializeJob(next) });
  }

  async claimJob(jobId, runnerId) {
    const job = await this.findJob(jobId);
    if (!job || job.status !== "queued") return null;
    const lease = await this.leaseStore.acquire(jobId, runnerId);
    if (!lease) return null;
    try {
      await this.setStatus(job, "running");
      await this.appendEvent(job, createEvent({ jobId, type: "claimed", phase: "runner", status: "running", summary: `Claimed by runner ${runnerId}`, now: this.now(), ruleVersion: this.ruleVersion }));
      return { ...job, status: "running" };
    } catch (error) {
      await this.leaseStore.release(jobId, runnerId).catch(() => {});
      throw error;
    }
  }

  async heartbeat(jobId, runnerId, phase = "running") {
    await this.leaseStore.heartbeat(jobId, runnerId);
    const job = await this.findJob(jobId);
    if (job) await this.appendEvent(job, createEvent({ jobId, type: "heartbeat", phase, status: job.status, summary: "Runner heartbeat received", now: this.now(), ruleVersion: this.ruleVersion }));
  }

  async checkpoint(jobId, runnerId, checkpoint) {
    await this.leaseStore.heartbeat(jobId, runnerId);
    const job = await this.findJob(jobId);
    if (!job) throw new Error("job not found");
    const safe = {
      phase: String(checkpoint.phase ?? "unknown").slice(0, 120),
      summary: String(checkpoint.summary ?? "checkpoint").slice(0, 1000),
      ref: checkpoint.ref ? String(checkpoint.ref).slice(0, 200) : null,
      created_at: this.now().toISOString(),
    };
    const event = createEvent({ jobId, type: "checkpoint", phase: safe.phase, status: job.status, summary: safe.summary, refs: safe.ref ? [safe.ref] : [], now: this.now(), ruleVersion: this.ruleVersion });
    event.checkpoint = safe;
    await this.appendEvent(job, event);
  }

  async completeJob(jobId, runnerId, status, details = {}) {
    const job = await this.findJob(jobId);
    if (!job) throw new Error("job not found");
    const next = transitionJob(job, status, { now: this.now(), details });
    await this.setStatus(job, status, details.resourceMetrics ?? job.resource_metrics ?? null);
    const event = createEvent({ jobId, type: "completed", phase: "result", status, summary: status === "succeeded" ? "Required checks passed" : `Job ended with status ${status}`, now: this.now(), ruleVersion: this.ruleVersion });
    if (details.requiredChecks) event.required_checks = details.requiredChecks;
    if (details.resourceMetrics) event.resource_metrics = details.resourceMetrics;
    await this.appendEvent(job, event);
    await this.leaseStore.release(jobId, runnerId);
    return { ...next, status };
  }

  async approveJob(jobId, actor, decision) {
    const job = await this.findJob(jobId);
    if (!job || !["awaiting_approval", "stale", "paused"].includes(job.status)) throw new Error("job is not awaiting approval or resume review");
    const isResume = ["stale", "paused"].includes(job.status);
    const nextStatus = (!isResume && decision === "approve") || (isResume && decision === "resume") ? "queued" : decision === "pause" && !isResume ? "paused" : null;
    const resolvedStatus = nextStatus ?? (decision === "pause" && isResume && job.status !== "paused" ? "paused" : null);
    if (!resolvedStatus) throw new Error(isResume ? "decision must be resume or pause" : "decision must be approve or pause");
    await this.setStatus(job, resolvedStatus);
    await this.appendEvent(job, createEvent({ jobId, type: resolvedStatus === "paused" ? "paused" : isResume ? "resumed" : "approved", phase: "approval", status: resolvedStatus, summary: `${resolvedStatus === "paused" ? "Paused" : isResume ? "Resumed" : "Approved"} by ${actor}`, now: this.now(), ruleVersion: this.ruleVersion }));
    return this.getJob(jobId);
  }

  async pauseJob(jobId, actor, reason = "Paused by user") {
    const job = await this.findJob(jobId);
    if (!job || !["queued", "awaiting_approval", "stale"].includes(job.status)) {
      throw new Error("job cannot be safely paused in its current state");
    }
    transitionJob(job, "paused", { now: this.now() });
    await this.setStatus(job, "paused");
    await this.appendEvent(job, createEvent({ jobId, type: "paused", phase: "project-removal", status: "paused", summary: `${reason} by ${actor}`, now: this.now(), ruleVersion: this.ruleVersion }));
    return this.getJob(jobId);
  }
}
