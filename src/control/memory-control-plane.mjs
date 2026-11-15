import { createEvent, createJob, isActiveStatus, publicJob, transitionJob } from "../domain/job.mjs";

export class MemoryControlPlane {
  constructor({ now = () => new Date(), maxActiveJobs = 2, leaseTtlMs = 120000 } = {}) {
    this.now = now;
    this.maxActiveJobs = maxActiveJobs;
    this.leaseTtlMs = leaseTtlMs;
    this.jobs = new Map();
    this.leases = new Map();
    this.sequence = 0;
  }

  async createJob(input, { id } = {}) {
    if (id && this.jobs.has(id)) return structuredClone(this.jobs.get(id));
    const job = createJob(input, { now: this.now(), ...(id ? { id } : {}) });
    job.issue_number = ++this.sequence;
    job.issue_url = `memory://jobs/${job.issue_number}`;
    this.append(job, createEvent({
      jobId: job.id,
      type: "created",
      phase: "intake",
      status: job.status,
      summary: "Job accepted by the control plane",
      now: this.now(),
    }));
    this.jobs.set(job.id, job);
    return structuredClone(job);
  }

  async listJobs() {
    return [...this.jobs.values()]
      .sort((a, b) => b.requested_at.localeCompare(a.requested_at))
      .map((job) => structuredClone(publicJob(job)));
  }

  async listQueuedJobs() {
    return [...this.jobs.values()]
      .filter((job) => job.status === "queued" && job.depends_on.every((dependency) => this.jobs.get(dependency)?.status === "succeeded"))
      .sort((a, b) => (b.priority - a.priority) || a.requested_at.localeCompare(b.requested_at))
      .map((job) => structuredClone(job));
  }

  async getJob(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) return null;
    return structuredClone(publicJob(job));
  }

  async claimJob(jobId, runnerId) {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== "queued") return null;
    const active = [...this.leases.values()].filter((lease) => lease.expires_at > this.now().toISOString());
    if (active.length >= this.maxActiveJobs) return null;
    const lease = {
      job_id: jobId,
      runner_id: runnerId,
      acquired_at: this.now().toISOString(),
      heartbeat_at: this.now().toISOString(),
      expires_at: new Date(this.now().getTime() + this.leaseTtlMs).toISOString(),
    };
    this.leases.set(jobId, lease);
    const next = transitionJob(job, "running", { now: this.now() });
    next.events = job.events.slice();
    this.jobs.set(jobId, next);
    this.append(next, createEvent({
      jobId,
      type: "claimed",
      phase: "runner",
      status: "running",
      summary: `Claimed by runner ${runnerId}`,
      now: this.now(),
    }));
    return structuredClone(next);
  }

  async heartbeat(jobId, runnerId, phase = "running") {
    const job = this.jobs.get(jobId);
    const lease = this.leases.get(jobId);
    if (!job || !lease || lease.runner_id !== runnerId) throw new Error("active lease not found");
    lease.heartbeat_at = this.now().toISOString();
    lease.expires_at = new Date(this.now().getTime() + this.leaseTtlMs).toISOString();
    this.append(job, createEvent({
      jobId,
      type: "heartbeat",
      phase,
      status: job.status,
      summary: "Runner heartbeat received",
      now: this.now(),
    }));
  }

  async checkpoint(jobId, runnerId, checkpoint) {
    const job = this.jobs.get(jobId);
    const lease = this.leases.get(jobId);
    if (!job || !lease || lease.runner_id !== runnerId) throw new Error("active lease not found");
    const safe = {
      phase: String(checkpoint.phase ?? "unknown").slice(0, 120),
      summary: String(checkpoint.summary ?? "checkpoint").slice(0, 1000),
      ref: checkpoint.ref ? String(checkpoint.ref).slice(0, 200) : null,
      created_at: this.now().toISOString(),
    };
    job.checkpoint = safe;
    job.updated_at = safe.created_at;
    this.append(job, createEvent({
      jobId,
      type: "checkpoint",
      phase: safe.phase,
      status: job.status,
      summary: safe.summary,
      refs: safe.ref ? [safe.ref] : [],
      now: this.now(),
    }));
  }

  async completeJob(jobId, runnerId, status, details = {}) {
    const job = this.jobs.get(jobId);
    const lease = this.leases.get(jobId);
    if (!job || !lease || lease.runner_id !== runnerId) throw new Error("active lease not found");
    const next = transitionJob(job, status, { now: this.now(), details });
    next.events = job.events.slice();
    this.jobs.set(jobId, next);
    const event = createEvent({
      jobId,
      type: "completed",
      phase: "result",
      status,
      summary: status === "succeeded" ? "Required checks passed" : `Job ended with status ${status}`,
      now: this.now(),
    });
    if (details.requiredChecks) event.required_checks = details.requiredChecks;
    if (details.resourceMetrics) next.resource_metrics = details.resourceMetrics;
    if (details.resourceMetrics) event.resource_metrics = details.resourceMetrics;
    this.append(next, event);
    this.leases.delete(jobId);
    return structuredClone(next);
  }

  async approveJob(jobId, actor, decision) {
    const job = this.jobs.get(jobId);
    if (!job || !["awaiting_approval", "stale", "paused"].includes(job.status)) throw new Error("job is not awaiting approval or resume review");
    const isResume = ["stale", "paused"].includes(job.status);
    if ((!isResume && decision === "approve") || (isResume && decision === "resume")) {
      const next = transitionJob(job, "queued", { now: this.now() });
      next.events = job.events.slice();
      this.jobs.set(jobId, next);
      this.append(next, createEvent({ jobId, type: isResume ? "resumed" : "approved", phase: "approval", status: "queued", summary: `${isResume ? "Resumed" : "Approved"} by ${actor}`, now: this.now() }));
    } else if (decision === "pause" && job.status !== "paused") {
      const next = transitionJob(job, "paused", { now: this.now() });
      next.events = job.events.slice();
      this.jobs.set(jobId, next);
      this.append(next, createEvent({ jobId, type: "paused", phase: "approval", status: "paused", summary: `Paused by ${actor}`, now: this.now() }));
    } else {
      throw new Error(isResume ? "decision must be resume or pause" : "decision must be approve or pause");
    }
    return this.getJob(jobId);
  }

  async pauseJob(jobId, actor, reason = "Paused by user") {
    const job = this.jobs.get(jobId);
    if (!job || !["queued", "awaiting_approval", "stale"].includes(job.status)) {
      throw new Error("job cannot be safely paused in its current state");
    }
    const next = transitionJob(job, "paused", { now: this.now() });
    next.events = job.events.slice();
    this.jobs.set(jobId, next);
    this.append(next, createEvent({ jobId, type: "paused", phase: "project-removal", status: "paused", summary: `${reason} by ${actor}`, now: this.now() }));
    return this.getJob(jobId);
  }

  getActiveLeases() {
    return structuredClone([...this.leases.values()]);
  }

  async recoverStaleJobs() {
    const now = this.now().toISOString();
    for (const lease of [...this.leases.values()]) {
      if (lease.expires_at > now) continue;
      this.leases.delete(lease.job_id);
      const job = this.jobs.get(lease.job_id);
      if (!job || job.status !== "running") continue;
      const next = transitionJob(job, "stale", { now: this.now() });
      next.events = job.events.slice();
      this.jobs.set(job.id, next);
      this.append(next, createEvent({ jobId: job.id, type: "stale", phase: "recovery", status: "stale", summary: "Runner lease expired; human resume review required", now: this.now() }));
    }
  }

  append(job, event) {
    job.events ??= [];
    job.events.push(event);
    job.updated_at = event.created_at;
  }
}
