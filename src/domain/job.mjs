export const JOB_STATUSES = Object.freeze([
  "queued",
  "running",
  "awaiting_approval",
  "succeeded",
  "failed",
  "paused",
  "stale",
]);

export const STATUS_LABELS = Object.freeze({
  queued: "prompthub:queued",
  running: "prompthub:running",
  awaiting_approval: "prompthub:awaiting-approval",
  succeeded: "prompthub:succeeded",
  failed: "prompthub:failed",
  paused: "prompthub:paused",
  stale: "prompthub:stale",
});

const STATUS_TRANSITIONS = Object.freeze({
  queued: new Set(["running", "paused", "awaiting_approval"]),
  running: new Set(["succeeded", "failed", "paused", "stale", "awaiting_approval"]),
  awaiting_approval: new Set(["queued", "paused"]),
  succeeded: new Set([]),
  failed: new Set(["queued", "paused"]),
  paused: new Set(["queued", "stale"]),
  stale: new Set(["queued", "paused"]),
});

const SECRET_PATTERNS = [
  /gh[pousr]_[A-Za-z0-9_]{20,}/i,
  /sk-[A-Za-z0-9_-]{16,}/,
  /-----BEGIN [A-Z ]+ PRIVATE KEY-----/,
  /(?:password|passwd|secret|api[_-]?key|access[_-]?token)\s*[:=]\s*[^\s]+/i,
];

function assertSafeText(value, field, maxLength) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} is required`);
  }
  if (value.length > maxLength) {
    throw new Error(`${field} exceeds the maximum length`);
  }
  if (SECRET_PATTERNS.some((pattern) => pattern.test(value))) {
    throw new Error(`${field} appears to contain a secret; remove it before submitting`);
  }
}

function assertProject(value, allowedProjects) {
  assertSafeText(value, "project", 120);
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(value)) {
    throw new Error("project contains unsupported characters");
  }
  if (allowedProjects?.length > 0 && !allowedProjects.includes(value)) {
    throw new Error("project is not in the configured allowlist");
  }
}

export function validateJobInput(input, { allowedProjects = [] } = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("job payload must be an object");
  }
  assertSafeText(input.prompt, "prompt", 30000);
  assertProject(input.project, allowedProjects);
  const baseRef = input.baseRef ?? "main";
  assertSafeText(baseRef, "baseRef", 200);
  if (!/^[A-Za-z0-9._/-]+$/.test(baseRef)) {
    throw new Error("baseRef contains unsupported characters");
  }
  const priority = input.priority ?? 50;
  if (!Number.isInteger(priority) || priority < 0 || priority > 100) {
    throw new Error("priority must be an integer between 0 and 100");
  }
  const requiresApproval = input.requiresApproval === true;
  const dependsOn = input.dependsOn ?? [];
  if (!Array.isArray(dependsOn) || dependsOn.length > 20 || dependsOn.some((dependency) => typeof dependency !== "string" || !/^job_[A-Za-z0-9-]{1,100}$/.test(dependency))) {
    throw new Error("dependsOn must contain valid job IDs");
  }
  const risk = input.risk ?? "medium";
  if (!["low", "medium", "high"].includes(risk)) throw new Error("risk must be low, medium or high");
  return Object.freeze({
    prompt: input.prompt.trim(),
    project: input.project.trim(),
    baseRef,
    priority,
    requiresApproval,
    dependsOn: [...new Set(dependsOn)],
    risk,
  });
}

export function createJob(input, { now = new Date(), id = `job_${globalThis.crypto.randomUUID()}` } = {}) {
  const status = input.requiresApproval ? "awaiting_approval" : "queued";
  return {
    id,
    prompt: input.prompt,
    project: input.project,
    base_ref: input.baseRef,
    priority: input.priority,
    depends_on: input.dependsOn,
    risk: input.risk,
    status,
    requested_at: now.toISOString(),
    updated_at: now.toISOString(),
    required_checks: { passed: false, names: [] },
    resource_metrics: null,
    checkpoint: null,
    events: [],
    issue_number: null,
    issue_url: null,
  };
}

export function canTransition(from, to) {
  return from === to || Boolean(STATUS_TRANSITIONS[from]?.has(to));
}

export function transitionJob(job, status, { now = new Date(), details = {} } = {}) {
  if (!JOB_STATUSES.includes(status)) throw new Error(`unknown job status: ${status}`);
  if (!canTransition(job.status, status)) {
    throw new Error(`invalid job transition: ${job.status} -> ${status}`);
  }
  if (status === "succeeded" && details.requiredChecks?.passed !== true) {
    throw new Error("succeeded requires passing required checks");
  }
  const next = {
    ...job,
    ...details,
    status,
    updated_at: now.toISOString(),
  };
  if (details.requiredChecks) {
    next.required_checks = details.requiredChecks;
    delete next.requiredChecks;
  }
  return next;
}

export function createEvent({ jobId, type, phase = null, status = null, summary, refs = [], now = new Date(), ruleVersion = "local" }) {
  assertSafeText(summary, "summary", 2000);
  return {
    event_id: `evt_${globalThis.crypto.randomUUID()}`,
    job_id: jobId,
    type,
    phase,
    status,
    source: "prompthub",
    created_at: now.toISOString(),
    summary: summary.trim(),
    refs: Array.isArray(refs) ? refs.slice(0, 20) : [],
    rule_version: ruleVersion,
  };
}

export function isActiveStatus(status) {
  return status === "running";
}

export function publicJob(job) {
  return {
    id: job.id,
    project: job.project,
    base_ref: job.base_ref,
    priority: job.priority,
    status: job.status,
    requested_at: job.requested_at,
    updated_at: job.updated_at,
    required_checks: job.required_checks,
    resource_metrics: job.resource_metrics ?? null,
    checkpoint: job.checkpoint,
    depends_on: job.depends_on,
    risk: job.risk,
    events: job.events,
    issue_number: job.issue_number,
    issue_url: job.issue_url,
    prompt_preview: job.prompt.length > 180 ? `${job.prompt.slice(0, 177)}...` : job.prompt,
  };
}
