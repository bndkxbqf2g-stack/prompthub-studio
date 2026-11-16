const MAX_APPROVALS_PER_PROJECT = 100;
const MAX_AUDIT_EVENTS_PER_PROJECT = 500;
const MAX_EXECUTION_ATTEMPTS = 3;
const EXECUTION_LEASE_MS = 5 * 60 * 1000;
const MAX_QUOTA_AGE_MS = 60 * 60 * 1000;
const ACTIVE_STATUSES = new Set(["pending", "deferred", "info_requested"]);
const DECISION_STATUSES = new Set([...ACTIVE_STATUSES, "blocked_cost", "blocked_permissions"]);
const EXPIRABLE_STATUSES = new Set([...DECISION_STATUSES, "approved", "awaiting_executor"]);
const SECRET_PATTERNS = [
  /gh[pousr]_[A-Za-z0-9_]{20,}/i,
  /sk-[A-Za-z0-9_-]{16,}/,
  /-----BEGIN [A-Z ]+ PRIVATE KEY-----/,
  /(?:password|passwd|secret|api[_-]?key|access[_-]?token)\s*[:=]\s*[^\s]+/i,
];
const unknownCostPolicy = async () => ({ status: "unknown" });
const unknownPermissionPolicy = async () => ({ status: "unknown" });

function fail(statusCode, message) {
  throw Object.assign(new Error(message), { statusCode });
}

function safeText(value, field, maxLength, { optional = false } = {}) {
  if (optional && (value === undefined || value === null || value === "")) return "";
  if (typeof value !== "string" || value.trim().length === 0) fail(400, `${field} is required`);
  const text = value.trim();
  if (text.length > maxLength) fail(400, `${field} exceeds the maximum length`);
  if (SECRET_PATTERNS.some((pattern) => pattern.test(text))) fail(400, `${field} appears to contain a secret; remove it before submitting`);
  return text;
}

function safeList(value, field, { maxItems = 12, maxLength = 300 } = {}) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > maxItems) fail(400, `${field} must be a short list`);
  return [...new Set(value.map((item) => safeText(item, field, maxLength)))];
}

function freshTimestamp(value, now) {
  const timestamp = Date.parse(value ?? "");
  return Number.isFinite(timestamp) && timestamp <= now.getTime() && now.getTime() - timestamp <= MAX_QUOTA_AGE_MS;
}

function safeProviderReference(value) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 200
    && !SECRET_PATTERNS.some((pattern) => pattern.test(value));
}

function normalizeCost(value, now, { provider, projectId, actionType }) {
  const status = value?.status;
  const quota = value?.free_quota;
  const verifiedAt = Date.parse(value?.verified_at ?? "");
  const quotaMeasuredAt = Date.parse(quota?.measured_at ?? "");
  const targetMatches = value?.provider === provider && value?.project_id === projectId && value?.action_type === actionType;
  const costIsFresh = Number.isFinite(verifiedAt) && verifiedAt <= now.getTime() && now.getTime() - verifiedAt <= MAX_QUOTA_AGE_MS;
  const quotaIsFreshAndAvailable = quota?.status === "available"
    && Number.isSafeInteger(quota.remaining_credits)
    && quota.remaining_credits >= 0
    && Number.isSafeInteger(quota.required_credits)
    && quota.required_credits >= 0
    && quota.remaining_credits >= quota.required_credits
    && Number.isFinite(quotaMeasuredAt)
    && quotaMeasuredAt <= now.getTime()
    && now.getTime() - quotaMeasuredAt <= MAX_QUOTA_AGE_MS;
  if (status === "verified_zero"
    && targetMatches
    && costIsFresh
    && value.one_time_eur === 0
    && value.recurring_eur === 0
    && typeof value.source === "string"
    && /^[a-z0-9][a-z0-9_.:-]{1,119}$/i.test(value.source)
    && quotaIsFreshAndAvailable) {
    return {
      status,
      provider,
      project_id: projectId,
      action_type: actionType,
      one_time_eur: 0,
      recurring_eur: 0,
      source: value.source,
      verified_at: new Date(verifiedAt).toISOString(),
      free_quota: {
        status: quota.status,
        remaining_credits: quota.remaining_credits,
        required_credits: quota.required_credits,
        source: typeof quota.source === "string" && /^[a-z0-9][a-z0-9_.:-]{1,119}$/i.test(quota.source) ? quota.source : "provider_quota_readback",
        measured_at: new Date(quotaMeasuredAt).toISOString(),
      },
    };
  }
  if (status === "verified_zero" && targetMatches && costIsFresh && quota?.status === "exhausted"
    && Number.isSafeInteger(quota.remaining_credits) && quota.remaining_credits >= 0
    && Number.isSafeInteger(quota.required_credits) && quota.required_credits >= 0
    && typeof value.source === "string" && /^[a-z0-9][a-z0-9_.:-]{1,119}$/i.test(value.source)
    && Number.isFinite(quotaMeasuredAt) && quotaMeasuredAt <= now.getTime() && now.getTime() - quotaMeasuredAt <= MAX_QUOTA_AGE_MS) {
    return {
      status: "quota_exhausted", provider, project_id: projectId, action_type: actionType, one_time_eur: null, recurring_eur: null,
      source: value.source, verified_at: new Date(verifiedAt).toISOString(),
      free_quota: {
        status: "exhausted", remaining_credits: quota.remaining_credits, required_credits: quota.required_credits,
        source: typeof quota.source === "string" && /^[a-z0-9][a-z0-9_.:-]{1,119}$/i.test(quota.source) ? quota.source : "provider_quota_readback",
        measured_at: new Date(quotaMeasuredAt).toISOString(),
      },
    };
  }
  if (status === "paid" && Number.isFinite(value.one_time_eur) && value.one_time_eur >= 0) {
    return {
      status: "paid",
      provider: targetMatches ? provider : "unknown",
      project_id: targetMatches ? projectId : null,
      action_type: targetMatches ? actionType : "unknown",
      one_time_eur: value.one_time_eur,
      recurring_eur: Number.isFinite(value.recurring_eur) && value.recurring_eur >= 0 ? value.recurring_eur : null,
      source: typeof value.source === "string" && /^[a-z0-9][a-z0-9_.:-]{1,119}$/i.test(value.source) ? value.source : "provider_readback",
      verified_at: Number.isFinite(verifiedAt) && verifiedAt <= now.getTime() ? new Date(verifiedAt).toISOString() : null,
    };
  }
  return { status: "unknown", one_time_eur: null, recurring_eur: null, source: "no_verified_provider_readback", verified_at: null };
}

function normalizePermissionPolicy(value, requested, { provider, projectId, actionType, now }) {
  const verifiedAt = Date.parse(value?.verified_at ?? "");
  const fresh = Number.isFinite(verifiedAt) && verifiedAt <= now.getTime() && now.getTime() - verifiedAt <= MAX_QUOTA_AGE_MS;
  const sourceValid = typeof value?.source === "string" && /^[a-z0-9][a-z0-9_.:-]{1,119}$/i.test(value.source);
  if (value?.status !== "verified" || value.provider !== provider || value.project_id !== projectId || value.action_type !== actionType
    || !fresh || !sourceValid || !Array.isArray(value.granted_permissions)
    || value.granted_permissions.some((item) => typeof item !== "string" || item.length > 300 || SECRET_PATTERNS.some((pattern) => pattern.test(item)))) {
    return { status: "unknown", provider, project_id: projectId, action_type: actionType, granted_permissions: [], missing_permissions: [...requested], source: "provider_authorization_not_verified", verified_at: null };
  }
  const granted = [...new Set(value.granted_permissions.filter((item) => typeof item === "string").map((item) => item.trim()))];
  const missing = requested.filter((permission) => !granted.includes(permission));
  return {
    status: missing.length ? "missing" : "verified",
    provider,
    project_id: projectId,
    action_type: actionType,
    verified_at: new Date(verifiedAt).toISOString(),
    granted_permissions: granted,
    missing_permissions: missing,
    source: value.source,
  };
}

function publicApproval(approval) {
  return structuredClone(approval);
}

function appendAudit(data, event) {
  const audit = Array.isArray(data.approval_audit) ? data.approval_audit : [];
  audit.push(event);
  data.approval_audit = audit.slice(-MAX_AUDIT_EVENTS_PER_PROJECT);
}

function appendEvent(approval, event) {
  approval.history.push(event);
  if (approval.history.length > 100) approval.history = approval.history.slice(-100);
}

export class ApprovalManager {
  constructor({ projectService, now = () => new Date(), idFactory = () => globalThis.crypto.randomUUID(), costPolicy = null, permissionPolicy = null, executors = new Map(), verifiers = new Map(), executionLeaseMs = EXECUTION_LEASE_MS, executionLeaseRenewalMs = Math.min(60_000, Math.floor(executionLeaseMs / 3)) } = {}) {
    if (!projectService) throw new Error("project service is required");
    if (!Number.isSafeInteger(executionLeaseMs) || executionLeaseMs < 3 || !Number.isSafeInteger(executionLeaseRenewalMs)
      || executionLeaseRenewalMs < 1 || executionLeaseRenewalMs >= executionLeaseMs) throw new Error("execution lease timing is invalid");
    this.projectService = projectService;
    this.now = now;
    this.idFactory = idFactory;
    this.costPolicy = costPolicy ?? unknownCostPolicy;
    this.permissionPolicy = permissionPolicy ?? unknownPermissionPolicy;
    this.costPolicyConfigured = typeof costPolicy === "function";
    this.permissionPolicyConfigured = typeof permissionPolicy === "function";
    this.executors = executors;
    this.verifiers = verifiers;
    this.executionLeaseMs = executionLeaseMs;
    this.executionLeaseRenewalMs = executionLeaseRenewalMs;
    this.executing = new Set();
  }

  async status() {
    const executors = this.executors instanceof Map ? [...this.executors.values()] : Object.values(this.executors ?? {});
    const executorCount = executors.length;
    const safeExecutorCount = executors.filter((executor) => executor?.idempotencyMode === "provider_enforced"
      && executor?.abortMode === "signal_supported" && typeof executor.supports === "function" && typeof executor.execute === "function").length;
    const verifiers = this.verifiers instanceof Map ? [...this.verifiers.values()] : Object.values(this.verifiers ?? {});
    const verifierCount = verifiers.filter((verifier) => typeof verifier === "function").length;
    return {
      execution: safeExecutorCount === 0 ? "not_configured" : verifierCount === 0 ? "verification_not_configured" : "configured",
      executor_count: executorCount,
      safety_contract_executor_count: safeExecutorCount,
      independent_verifier_count: verifierCount,
      codex_remote: "native_codex_remote_not_integrated",
      codex_cloud: "not_configured",
      browser_automation: "not_configured_in_pwa_runtime",
      github: "configured_control_plane",
      provider_authorization: this.permissionPolicyConfigured ? "configured_readback_required_per_action" : "not_configured",
      cost_quota_readback: this.costPolicyConfigured ? "configured_readback_required_per_action" : "not_configured",
      netlify: "not_configured_in_pwa_runtime",
      push_notifications: "unavailable_poll_inbox",
      maximum_active_development_jobs: 2,
      recurring_budget_eur: 0,
      paid_actions: "blocked",
      native_codex_approvals: "remain_in_codex",
    };
  }

  async create(input, { actor, idempotencyKey } = {}) {
    const projectId = safeText(input?.project, "project", 250);
    const project = await this.projectService.get(projectId);
    if (!project || project.status !== "connected") fail(409, "project_not_connected");
    const requester = safeText(actor, "actor", 100);
    const key = safeText(idempotencyKey, "idempotency_key", 120);
    if (!/^[A-Za-z0-9._:-]{8,120}$/.test(key)) fail(400, "idempotency_key is invalid");

    const service = safeText(input.service, "service", 80).toLowerCase();
    if (!/^[a-z][a-z0-9.-]{1,79}$/.test(service)) fail(400, "service is invalid");
    const actionType = safeText(input.action_type, "action_type", 100).toLowerCase();
    if (!/^[a-z][a-z0-9_.-]{1,99}$/.test(actionType)) fail(400, "action_type is invalid");
    if (/^(?:codex[._-]native|native[._-]codex)/.test(actionType)) fail(400, "native_codex_approval_must_use_codex_remote");
    const action = {
      type: actionType,
      title: safeText(input.action_title, "action_title", 160),
      description: safeText(input.action_description, "action_description", 3000),
    };
    const reason = safeText(input.reason, "reason", 1500);
    const requestedPermissions = safeList(input.requested_permissions, "requested_permissions");
    const impacts = safeList(input.impacts, "impacts", { maxItems: 8, maxLength: 500 });
    const risks = safeList(input.security_risks, "security_risks", { maxItems: 8, maxLength: 500 });
    if (!impacts.length) fail(400, "impacts must describe at least one expected effect");
    if (!risks.length) fail(400, "security_risks must describe at least one risk or explicitly state none identified");
    const ttlHours = Number.isInteger(input.expires_in_hours) ? input.expires_in_hours : 24;
    if (ttlHours < 1 || ttlHours > 168) fail(400, "expires_in_hours must be between 1 and 168");
    const requestDigest = await this.digest(JSON.stringify({ project: project.id, service, action, reason, requestedPermissions, impacts, risks, ttlHours }));
    const requestedAt = this.now();
    const costEvidence = await Promise.resolve().then(() => this.costPolicy({ project, service, actionType })).catch(() => null);
    const permissionEvidence = await Promise.resolve().then(() => this.permissionPolicy({ project, service, actionType, requestedPermissions })).catch(() => null);
    const evidenceTime = this.now();
    const cost = normalizeCost(costEvidence, evidenceTime, { provider: service, projectId: project.id, actionType });
    const permissions = normalizePermissionPolicy(permissionEvidence, requestedPermissions, { provider: service, projectId: project.id, actionType, now: evidenceTime });
    let result;
    await this.projectService.updateProjectData(project.id, (data) => {
      data.approvals ??= [];
      const duplicate = data.approvals.find((item) => item.created_by === requester && item.request_idempotency_key === key);
      if (duplicate) {
        if (duplicate.request_digest !== requestDigest) fail(409, "idempotency_key_conflict");
        result = duplicate;
        return data;
      }
      if (data.approvals.length >= MAX_APPROVALS_PER_PROJECT) fail(409, "approval_retention_limit_reached");
      const createdAt = requestedAt.toISOString();
      const approval = {
        id: `approval_${this.idFactory()}`,
        project_id: project.id,
        project_name: project.full_name,
        service,
        action,
        reason,
        requested_permissions: requestedPermissions,
        permission_check: permissions,
        impacts,
        security_risks: risks,
        cost,
        status: ["paid", "quota_exhausted"].includes(cost.status) ? "blocked_cost" : "pending",
        execution_status: cost.status !== "verified_zero" ? "blocked_cost" : permissions.status !== "verified" ? "blocked_permissions" : "not_started",
        created_at: createdAt,
        created_by: requester,
        expires_at: new Date(requestedAt.getTime() + ttlHours * 60 * 60 * 1000).toISOString(),
        request_idempotency_key: key,
        request_digest: requestDigest,
        decision: null,
        execution: { attempts: 0, idempotency_key: `prompthub:${project.id}:${this.idFactory()}`, evidence: null },
        history: [{ at: createdAt, event: "requested", actor: requester, status: ["paid", "quota_exhausted"].includes(cost.status) ? "blocked_cost" : "pending" }],
      };
      data.approvals.push(approval);
      appendAudit(data, { at: createdAt, approval_id: approval.id, project_id: project.id, event: "requested", actor: requester, status: approval.status });
      result = approval;
      return data;
    });
    return publicApproval(result);
  }

  async list({ actor } = {}) {
    const requester = safeText(actor, "actor", 100);
    const projects = await this.projectService.list();
    const entries = [];
    for (const project of projects) {
      const data = await this.projectService.getProjectData(project.id);
      const approvals = Array.isArray(data.approvals) ? data.approvals : [];
      const now = this.now();
      const expiredIds = approvals.filter((item) => EXPIRABLE_STATUSES.has(item.status) && Date.parse(item.expires_at) <= now.getTime()).map((item) => item.id);
      const overdueVerificationIds = approvals.filter((item) => item.status === "awaiting_verification"
        && Date.parse(item.execution?.verification_deadline_at ?? "") <= now.getTime()).map((item) => item.id);
      const staleExecutions = approvals.filter((item) => item.status === "executing"
        && !this.executing.has(item.id)
        && Date.parse(item.execution?.lease_expires_at ?? "") <= now.getTime()).map((item) => item.id);
      let listedApprovals = approvals;
      if (expiredIds.length || overdueVerificationIds.length || staleExecutions.length) {
        await this.projectService.updateProjectData(project.id, (current) => {
          current.approvals ??= [];
          const at = now.toISOString();
          for (const item of current.approvals) {
            if (expiredIds.includes(item.id) && EXPIRABLE_STATUSES.has(item.status)) {
              item.status = "expired";
              appendEvent(item, { at, event: "expired", actor: "system", status: item.status });
              appendAudit(current, { at, approval_id: item.id, project_id: project.id, event: "expired", actor: "system", status: item.status });
            }
            if (overdueVerificationIds.includes(item.id) && item.status === "awaiting_verification") {
              item.status = "execution_unknown";
              item.execution_status = "reconciliation_required";
              appendEvent(item, { at, event: "verification_overdue", actor: "system", status: item.status });
              appendAudit(current, { at, approval_id: item.id, project_id: project.id, event: "verification_overdue", actor: "system", status: item.status });
            }
            if (staleExecutions.includes(item.id) && item.status === "executing") {
              item.status = "execution_unknown";
              item.execution_status = "reconciliation_required";
              appendEvent(item, { at, event: "execution_lease_expired", actor: "system", status: item.status });
              appendAudit(current, { at, approval_id: item.id, project_id: project.id, event: "execution_lease_expired", actor: "system", status: item.status });
            }
          }
          return current;
        });
        listedApprovals = (await this.projectService.getProjectData(project.id)).approvals;
      }
      for (const item of listedApprovals) {
        if (item.created_by === requester) entries.push({ ...publicApproval(item), project_status: project.status });
      }
    }
    return entries.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  async decide(id, payload, { actor, authenticatedGithub = false, idempotencyKey } = {}) {
    if (!authenticatedGithub) fail(403, "github_human_authentication_required_for_approval_decisions");
    const requester = safeText(actor, "actor", 100);
    const decision = payload?.decision;
    if (!["approve", "reject", "request_information", "defer"].includes(decision)) fail(400, "decision must be approve, reject, request_information or defer");
    const key = safeText(idempotencyKey, "idempotency_key", 120);
    if (!/^[A-Za-z0-9._:-]{8,120}$/.test(key)) fail(400, "idempotency_key is invalid");
    const message = decision === "request_information" ? safeText(payload.message, "message", 1500) : "";
    let projectId = null;
    let changed;
    let duplicateDecision = false;
    for (const project of await this.projectService.list()) {
      const data = await this.projectService.getProjectData(project.id);
      if ((data.approvals ?? []).some((item) => item.id === id)) { projectId = project.id; break; }
    }
    if (!projectId) fail(404, "approval_not_found");
    const project = await this.projectService.get(projectId);
    if (!project || project.status !== "connected") fail(409, "project_not_connected");
    const now = this.now();
    await this.projectService.updateProjectData(projectId, (data) => {
      const approval = (data.approvals ?? []).find((item) => item.id === id);
      if (!approval) fail(404, "approval_not_found");
      if (approval.created_by !== requester) fail(403, "only_requester_may_decide_approval");
      if (EXPIRABLE_STATUSES.has(approval.status) && Date.parse(approval.expires_at) <= now.getTime()) {
        approval.status = "expired";
        appendEvent(approval, { at: now.toISOString(), event: "expired", actor: "system", status: approval.status });
        appendAudit(data, { at: now.toISOString(), approval_id: id, project_id: projectId, event: "expired", actor: "system", status: approval.status });
        changed = approval;
        return data;
      }
      if (approval.decision?.idempotency_key === key && approval.decision.actor === requester && approval.decision.choice === decision) { changed = approval; duplicateDecision = true; return data; }
      if (!DECISION_STATUSES.has(approval.status)) fail(409, "approval_is_not_actionable");
      if (decision === "approve" && (approval.cost.status !== "verified_zero" || approval.cost.one_time_eur !== 0 || approval.cost.recurring_eur !== 0)) {
        fail(409, "zero_cost_not_verified_action_remains_paused");
      }
      if (decision === "approve" && !freshTimestamp(approval.cost.verified_at, now)) fail(409, "zero_cost_evidence_expired_action_remains_paused");
      if (decision === "approve" && (approval.permission_check?.status !== "verified" || approval.permission_check.missing_permissions.length > 0)) {
        fail(409, "required_provider_permissions_not_verified_action_remains_paused");
      }
      if (decision === "approve" && !freshTimestamp(approval.permission_check?.verified_at, now)) fail(409, "provider_permission_evidence_expired_action_remains_paused");
      const status = { approve: "approved", reject: "rejected", request_information: "info_requested", defer: "deferred" }[decision];
      approval.status = status;
      if (decision === "approve") approval.execution_status = "not_started";
      approval.decision = { choice: decision, actor: requester, at: now.toISOString(), message, idempotency_key: key };
      appendEvent(approval, { at: now.toISOString(), event: decision, actor: requester, status, ...(message ? { message } : {}) });
      appendAudit(data, { at: now.toISOString(), approval_id: id, project_id: projectId, event: decision, actor: requester, status });
      changed = approval;
      return data;
    });
    if (changed.status === "expired") fail(409, "approval_expired");
    if (duplicateDecision) return publicApproval(changed);
    if (decision === "approve") return this.resume(id, { actor: requester, authenticatedGithub: true });
    return publicApproval(changed);
  }

  async cancel(id, { actor, authenticatedGithub = false } = {}) {
    if (!authenticatedGithub) fail(403, "github_human_authentication_required_for_approval_decisions");
    const requester = safeText(actor, "actor", 100);
    const { project, approval } = await this.find(id);
    if (approval.created_by !== requester) fail(403, "only_requester_may_cancel_approval");
    if (!ACTIVE_STATUSES.has(approval.status) && !["approved", "awaiting_executor", "blocked_cost", "blocked_permissions"].includes(approval.status)) fail(409, "approval_is_not_cancellable");
    const now = this.now().toISOString();
    let result;
    await this.projectService.updateProjectData(project.id, (data) => {
      const current = data.approvals.find((item) => item.id === id);
      if (!current || current.status === "executing" || current.status === "succeeded" || current.status === "execution_unknown") fail(409, "approval_execution_cannot_be_cancelled_safely");
      current.status = "cancelled";
      current.execution_status = "cancelled_before_execution";
      appendEvent(current, { at: now, event: "cancelled", actor: requester, status: current.status });
      appendAudit(data, { at: now, approval_id: id, project_id: project.id, event: "cancelled", actor: requester, status: current.status });
      result = current;
      return data;
    });
    return publicApproval(result);
  }

  async resume(id, { actor, authenticatedGithub = false } = {}) {
    if (!authenticatedGithub) fail(403, "github_human_authentication_required_for_approval_decisions");
    const requester = safeText(actor, "actor", 100);
    const found = await this.find(id);
    const project = found.project;
    const approval = found.approval;
    if (!project || project.status !== "connected") fail(409, "project_not_connected");
    if (approval.created_by !== requester || approval.decision?.actor !== requester) fail(403, "only_original_requester_may_resume_approval");
    if (!approval.decision || approval.decision.choice !== "approve") fail(409, "approval_decision_required");
    const beforePolicyTime = this.now();
    if (EXPIRABLE_STATUSES.has(approval.status) && Date.parse(approval.expires_at) <= beforePolicyTime.getTime()) {
      return this.expireApproval(project.id, id);
    }
    if (["succeeded", "execution_unknown", "awaiting_verification"].includes(approval.status)) return publicApproval(approval);
    if (approval.status === "executing") {
      if (Date.parse(approval.execution?.lease_expires_at ?? "") <= beforePolicyTime.getTime()) {
        return this.setStatus(project.id, id, "execution_unknown", "reconciliation_required", "system", "execution_lease_expired");
      }
      return publicApproval(approval);
    }
    const currentCostEvidence = await Promise.resolve().then(() => this.costPolicy({ project, service: approval.service, actionType: approval.action.type })).catch(() => null);
    const policyTime = this.now();
    const target = { provider: approval.service, projectId: project.id, actionType: approval.action.type };
    const currentCost = normalizeCost(currentCostEvidence, policyTime, target);
    const permissionEvidence = await Promise.resolve().then(() => this.permissionPolicy({ project, service: approval.service, actionType: approval.action.type, requestedPermissions: approval.requested_permissions })).catch(() => null);
    const currentPermissions = normalizePermissionPolicy(permissionEvidence, approval.requested_permissions, { ...target, now: this.now() });
    if (currentCost.status !== "verified_zero" || currentCost.one_time_eur !== 0 || currentCost.recurring_eur !== 0) {
      return this.setPolicyBlock(project.id, id, "blocked_cost", "blocked_cost", requester, currentCost, currentPermissions);
    }
    if (currentPermissions.status !== "verified" || currentPermissions.missing_permissions.length) {
      return this.setPolicyBlock(project.id, id, "blocked_permissions", "blocked_permissions", requester, currentCost, currentPermissions);
    }
    const executor = this.getExecutor(approval.service);
    if (!executor || typeof executor.supports !== "function" || !executor.supports(approval.action.type)) {
      return this.setStatus(project.id, id, "awaiting_executor", "executor_not_configured", requester, "awaiting_executor");
    }
    if (executor.idempotencyMode !== "provider_enforced" || executor.abortMode !== "signal_supported") {
      return this.setStatus(project.id, id, "awaiting_executor", "provider_safety_contract_required", requester, "executor_safety_gate_blocked");
    }
    if (approval.execution?.attempts >= MAX_EXECUTION_ATTEMPTS) fail(409, "execution_retry_limit_reached");
    if (this.executing.has(id)) return publicApproval(approval);
    if (approval.status === "failed" && (approval.execution?.failure_mode !== "no_effect" || executor.idempotencyMode !== "provider_enforced" || executor.abortMode !== "signal_supported")) {
      fail(409, "retry_requires_verified_no_effect_and_idempotent_executor");
    }

    let started;
    let alreadyExecuting = false;
    let expiredBeforeStart = false;
    const startTime = this.now();
    await this.projectService.updateProjectData(project.id, (data) => {
      const current = data.approvals.find((item) => item.id === id);
      if (!current || !current.decision || current.decision.choice !== "approve") fail(409, "approval_decision_required");
      if (current.created_by !== requester || current.decision.actor !== requester) fail(403, "only_original_requester_may_resume_approval");
      if (EXPIRABLE_STATUSES.has(current.status) && Date.parse(current.expires_at) <= startTime.getTime()) {
        current.status = "expired";
        current.execution_status = "expired_before_execution";
        appendEvent(current, { at: startTime.toISOString(), event: "expired", actor: "system", status: current.status });
        appendAudit(data, { at: startTime.toISOString(), approval_id: id, project_id: project.id, event: "expired", actor: "system", status: current.status });
        expiredBeforeStart = true;
        started = current;
        return data;
      }
      if (["executing", "awaiting_verification", "succeeded", "execution_unknown"].includes(current.status)) { alreadyExecuting = true; started = current; return data; }
      if (!["approved", "awaiting_executor", "blocked_cost", "blocked_permissions", "failed"].includes(current.status)) fail(409, "approval_is_not_resumable");
      if (current.status === "failed" && (current.execution?.failure_mode !== "no_effect" || executor.idempotencyMode !== "provider_enforced" || executor.abortMode !== "signal_supported")) fail(409, "retry_requires_verified_no_effect_and_idempotent_executor");
      const freshCost = currentCost.status === "verified_zero" && currentCost.one_time_eur === 0 && currentCost.recurring_eur === 0
        && freshTimestamp(currentCost.verified_at, startTime);
      const freshPermissions = currentPermissions.status === "verified" && currentPermissions.missing_permissions.length === 0
        && freshTimestamp(currentPermissions.verified_at, startTime);
      if (!freshCost || !freshPermissions) {
        current.status = !freshCost ? "blocked_cost" : "blocked_permissions";
        current.execution_status = current.status;
        current.cost = currentCost;
        current.permission_check = currentPermissions;
        appendEvent(current, { at: startTime.toISOString(), event: current.status, actor: "system", status: current.status });
        appendAudit(data, { at: startTime.toISOString(), approval_id: id, project_id: project.id, event: current.status, actor: "system", status: current.status });
        started = current;
        return data;
      }
      current.cost = currentCost;
      current.permission_check = currentPermissions;
      current.status = "executing";
      current.execution_status = "executing";
      current.execution.attempts += 1;
      current.execution.lease_expires_at = new Date(startTime.getTime() + this.executionLeaseMs).toISOString();
      current.execution.last_started_at = startTime.toISOString();
      appendEvent(current, { at: startTime.toISOString(), event: "execution_started", actor: requester, status: current.status, attempt: current.execution.attempts });
      appendAudit(data, { at: startTime.toISOString(), approval_id: id, project_id: project.id, event: "execution_started", actor: requester, status: current.status });
      started = current;
      return data;
    });

    if (expiredBeforeStart || alreadyExecuting || started.status.startsWith("blocked_")) return publicApproval(started);

    this.executing.add(id);
    const abortController = new AbortController();
    let resolveLeaseLost;
    const leaseLost = new Promise((resolve) => { resolveLeaseLost = resolve; });
    const renewalState = { active: true, lost: false, chain: Promise.resolve() };
    let renewalTimer;
    const loseLease = () => {
      if (renewalState.lost) return;
      renewalState.lost = true;
      renewalState.active = false;
      clearInterval(renewalTimer);
      abortController.abort();
      resolveLeaseLost();
    };
    renewalTimer = setInterval(() => {
      renewalState.chain = renewalState.chain.then(async () => {
        if (renewalState.active && !await this.renewExecutionLease(project.id, id)) loseLease();
      }).catch(loseLease);
    }, this.executionLeaseRenewalMs);
    renewalTimer.unref?.();
    try {
      const outcome = await Promise.race([
        Promise.resolve().then(() => executor.execute({ approval: publicApproval(started), idempotencyKey: started.execution.idempotency_key, signal: abortController.signal })).then((receipt) => ({ kind: "receipt", receipt })),
        leaseLost.then(() => ({ kind: "lease_lost" })),
      ]);
      clearInterval(renewalTimer);
      renewalState.active = false;
      await renewalState.chain;
      if (outcome.kind === "lease_lost" || renewalState.lost) {
        return await this.setStatus(project.id, id, "execution_unknown", "reconciliation_required", "system", "execution_lease_renewal_failed");
      }
      const receipt = outcome.receipt;
      if (!receipt || receipt.status !== "submitted" || receipt.idempotency_key !== started.execution.idempotency_key
        || !safeProviderReference(receipt.reference)) {
        return this.setStatus(project.id, id, "execution_unknown", "reconciliation_required", "system", "execution_unknown");
      }
      const afterExecute = await this.setExecutionReceipt(project.id, id, receipt.reference);
      const verifier = this.getVerifier(approval.service);
      if (typeof verifier !== "function") return afterExecute;
      const verification = await verifier({ approval: publicApproval(afterExecute), receipt: { reference: receipt.reference } });
      const verifiedAt = Date.parse(verification?.verified_at ?? "");
      const verifiedNow = this.now().getTime();
      if (!verification || verification.verified !== true || verification.provider !== approval.service || verification.project_id !== project.id
        || verification.action_type !== approval.action.type || !Number.isFinite(verifiedAt) || verifiedAt > verifiedNow || verifiedNow - verifiedAt > MAX_QUOTA_AGE_MS
        || verification.verified_receipt_reference !== receipt.reference
        || !safeProviderReference(verification.reference)
        || typeof verification.source !== "string" || !/^[a-z0-9][a-z0-9_.:-]{1,119}$/i.test(verification.source)) return afterExecute;
      return this.setStatus(project.id, id, "succeeded", "verified", requester, "succeeded", {
        provider: approval.service, project_id: project.id, action_type: approval.action.type,
        submitted_receipt_reference: receipt.reference, reference: verification.reference, source: verification.source, verified_at: new Date(verifiedAt).toISOString(),
      });
    } catch {
      return this.setStatus(project.id, id, "execution_unknown", "reconciliation_required", "system", renewalState.lost ? "execution_lease_renewal_failed" : "execution_unknown");
    } finally {
      clearInterval(renewalTimer);
      renewalState.active = false;
      await renewalState.chain;
      this.executing.delete(id);
    }
  }

  async digest(value) {
    const bytes = new TextEncoder().encode(value);
    const hash = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  getExecutor(service) {
    return this.executors instanceof Map ? this.executors.get(service) : this.executors?.[service];
  }

  getVerifier(service) {
    return this.verifiers instanceof Map ? this.verifiers.get(service) : this.verifiers?.[service];
  }

  async find(id) {
    for (const project of await this.projectService.list()) {
      const data = await this.projectService.getProjectData(project.id);
      const approval = (data.approvals ?? []).find((item) => item.id === id);
      if (approval) return { project, approval: publicApproval(approval) };
    }
    fail(404, "approval_not_found");
  }

  async expireApproval(projectId, id) {
    let result;
    const now = this.now();
    await this.projectService.updateProjectData(projectId, (data) => {
      const current = (data.approvals ?? []).find((item) => item.id === id);
      if (!current) fail(404, "approval_not_found");
      if (EXPIRABLE_STATUSES.has(current.status) && Date.parse(current.expires_at) <= now.getTime()) {
        current.status = "expired";
        current.execution_status = "expired_before_execution";
        appendEvent(current, { at: now.toISOString(), event: "expired", actor: "system", status: current.status });
        appendAudit(data, { at: now.toISOString(), approval_id: id, project_id: projectId, event: "expired", actor: "system", status: current.status });
      }
      result = current;
      return data;
    });
    return publicApproval(result);
  }

  async renewExecutionLease(projectId, id) {
    let result;
    const now = this.now();
    await this.projectService.updateProjectData(projectId, (data) => {
      const current = (data.approvals ?? []).find((item) => item.id === id);
      if (!current || current.status !== "executing") { result = current ?? null; return data; }
      const leaseExpiresAt = Date.parse(current.execution?.lease_expires_at ?? "");
      if (!Number.isFinite(leaseExpiresAt) || leaseExpiresAt <= now.getTime()) {
        current.status = "execution_unknown";
        current.execution_status = "reconciliation_required";
        current.execution.lease_expires_at = null;
        appendEvent(current, { at: now.toISOString(), event: "execution_lease_expired", actor: "system", status: current.status });
        appendAudit(data, { at: now.toISOString(), approval_id: id, project_id: projectId, event: "execution_lease_expired", actor: "system", status: current.status });
      } else {
        current.execution.lease_expires_at = new Date(now.getTime() + this.executionLeaseMs).toISOString();
        current.execution.last_heartbeat_at = now.toISOString();
      }
      result = current;
      return data;
    });
    return result?.status === "executing";
  }

  async setExecutionReceipt(projectId, id, reference) {
    let result;
    const now = this.now().toISOString();
    await this.projectService.updateProjectData(projectId, (data) => {
      const current = data.approvals.find((item) => item.id === id);
      if (!current || current.status !== "executing") fail(409, "execution_state_changed");
      current.status = "awaiting_verification";
      current.execution_status = "awaiting_verification";
      current.execution.receipt_reference = reference;
      current.execution.verification_deadline_at = new Date(new Date(now).getTime() + 24 * 60 * 60 * 1000).toISOString();
      current.execution.lease_expires_at = null;
      appendEvent(current, { at: now, event: "execution_submitted", actor: "system", status: current.status });
      appendAudit(data, { at: now, approval_id: id, project_id: projectId, event: "execution_submitted", actor: "system", status: current.status });
      result = current;
      return data;
    });
    return publicApproval(result);
  }

  async setPolicyBlock(projectId, id, status, executionStatus, actor, cost, permissionCheck) {
    let result;
    const now = this.now().toISOString();
    await this.projectService.updateProjectData(projectId, (data) => {
      const current = data.approvals.find((item) => item.id === id);
      if (!current) fail(404, "approval_not_found");
      current.status = status;
      current.execution_status = executionStatus;
      current.cost = cost;
      current.permission_check = permissionCheck;
      appendEvent(current, { at: now, event: status, actor, status: current.status });
      appendAudit(data, { at: now, approval_id: id, project_id: projectId, event: status, actor, status: current.status });
      result = current;
      return data;
    });
    return publicApproval(result);
  }

  async setStatus(projectId, id, status, executionStatus, actor, event, evidence = null) {
    let result;
    const now = this.now().toISOString();
    await this.projectService.updateProjectData(projectId, (data) => {
      const current = data.approvals.find((item) => item.id === id);
      if (!current) fail(404, "approval_not_found");
      current.status = status;
      current.execution_status = executionStatus;
      current.execution.lease_expires_at = null;
      if (evidence) current.execution.evidence = { ...evidence };
      appendEvent(current, { at: now, event, actor, status: current.status });
      appendAudit(data, { at: now, approval_id: id, project_id: projectId, event, actor, status: current.status });
      result = current;
      return data;
    });
    return publicApproval(result);
  }
}
