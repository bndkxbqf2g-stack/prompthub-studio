import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { readConfig } from "../src/config.mjs";
import { createControlPlane } from "../src/control/index.mjs";
import { createHttpServer } from "../src/api/server.mjs";
import { MemoryProjectStore } from "../src/projects/project-store.mjs";
import { ProjectService } from "../src/projects/project-service.mjs";
import { ApprovalManager } from "../src/automation/approval-manager.mjs";

class FakeRepositoryClient {
  async getRepository(id) { return { full_name: id, html_url: `https://github.com/${id}`, private: true, default_branch: "main", permissions: { pull: true, push: true } }; }
  async getContent(_repo, path) { return path === "AGENTS.md" ? { content: "Keep approval decisions explicit.", sha: "sha" } : null; }
  async listContents() { return []; }
  async listIssues() { return []; }
  async listWorkflowRuns() { return { workflow_runs: [] }; }
}

const zeroCost = async ({ project, service, actionType }) => {
  const measuredAt = new Date().toISOString();
  return { status: "verified_zero", provider: service, project_id: project.id, action_type: actionType, one_time_eur: 0, recurring_eur: 0, source: "test_provider_readback", verified_at: measuredAt, free_quota: { status: "available", remaining_credits: 100, required_credits: 1, source: "test_quota_readback", measured_at: measuredAt } };
};
const grantedPermissions = async ({ project, service, actionType, requestedPermissions }) => ({ status: "verified", provider: service, project_id: project.id, action_type: actionType, verified_at: new Date().toISOString(), granted_permissions: requestedPermissions, source: "test_oauth_readback" });

async function withServer(callback, { provider = "github", actor = "human-owner", managerOptions = {} } = {}) {
  const config = readConfig({ NODE_ENV: "test", PROMPTHUB_MODE: "memory", AUTH_MODE: "local" });
  const controlPlane = createControlPlane(config);
  const projectService = new ProjectService({ store: new MemoryProjectStore(), client: new FakeRepositoryClient(), controlPlane, controlRepository: "owner/control" });
  const approvalManager = new ApprovalManager({ projectService, ...managerOptions });
  let activeActor = actor;
  const auth = { async getSession() { return { provider, local: provider !== "github", user: { login: activeActor } }; } };
  const server = createHttpServer({ config, controlPlane, auth, projectService, approvalManager, logger: { error() {} } });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try { return await callback(`http://127.0.0.1:${server.address().port}`, { projectService, approvalManager, setActor(value) { activeActor = value; } }); }
  finally { await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
}

async function createRequest(base, { project = "owner/app", key = "request-key-0001", expires = 24 } = {}) {
  return fetch(`${base}/api/automation/approvals`, {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": key },
    body: JSON.stringify({
      project, service: "netlify", action_type: "netlify.link_repository", action_title: "Connect repository",
      action_description: "Connect this project to the selected Netlify site.", reason: "Enable automatic deployment after approval.",
      requested_permissions: ["repository read", "deployment"], impacts: ["Creates provider integration"], security_risks: ["Provider receives repository access"], expires_in_hours: expires,
    }),
  });
}

async function postDecision(base, approvalId, decision, key, extra = {}) {
  return fetch(`${base}/api/automation/approvals/${encodeURIComponent(approvalId)}/decision`, {
    method: "POST", headers: { "content-type": "application/json", "idempotency-key": key }, body: JSON.stringify({ decision, ...extra }),
  });
}

test("mobile approval inbox records a scoped, secret-filtered request with honest runtime capability status", async () => {
  await withServer(async (base, { projectService }) => {
    await projectService.connect("owner/app", "human-owner");
    const response = await createRequest(base);
    assert.equal(response.status, 201);
    const approval = (await response.json()).approval;
    assert.equal(approval.project_id, "owner/app");
    assert.equal(approval.project_name, "owner/app");
    assert.equal(approval.status, "pending");
    assert.equal(approval.cost.status, "unknown");
    assert.equal(approval.execution_status, "blocked_cost");
    assert.equal(approval.permission_check.status, "unknown");
    assert.ok(Date.parse(approval.expires_at) > Date.parse(approval.created_at));

    const inbox = await (await fetch(`${base}/api/automation/approvals`)).json();
    assert.equal(inbox.approvals.length, 1);
    const status = await (await fetch(`${base}/api/automation/status`)).json();
    assert.equal(status.automation.netlify, "not_configured_in_pwa_runtime");
    assert.equal(status.automation.codex_remote, "native_codex_remote_not_integrated");
    assert.equal(status.automation.push_notifications, "unavailable_poll_inbox");
    assert.equal(status.automation.recurring_budget_eur, 0);

    const secret = await fetch(`${base}/api/automation/approvals`, {
      method: "POST", headers: { "content-type": "application/json", "idempotency-key": "request-key-secret" },
      body: JSON.stringify({ project: "owner/app", service: "github", action_type: "github.test", action_title: "Test", action_description: "Use access_token=ghp_123456789012345678901234567890", reason: "Test" }),
    });
    assert.equal(secret.status, 400);
  });
});

test("approval decisions require a GitHub identity, verified zero cost, and verified provider permissions", async () => {
  await withServer(async (base, { projectService }) => {
    await projectService.connect("owner/app", "human-owner");
    const approval = (await (await createRequest(base)).json()).approval;
    const forbidden = await postDecision(base, approval.id, "reject", "decision-local-0001");
    assert.equal(forbidden.status, 403);
  }, { provider: "local" });

  await withServer(async (base, { projectService }) => {
    await projectService.connect("owner/app", "human-owner");
    const approval = (await (await createRequest(base)).json()).approval;
    const noCostProof = await postDecision(base, approval.id, "approve", "decision-cost-0001");
    assert.equal(noCostProof.status, 409);
    assert.equal((await noCostProof.json()).error, "zero_cost_not_verified_action_remains_paused");
  });

  await withServer(async (base, { projectService }) => {
    await projectService.connect("owner/app", "human-owner");
    const approval = (await (await createRequest(base)).json()).approval;
    const missing = await postDecision(base, approval.id, "approve", "decision-perm-0001");
    assert.equal(missing.status, 409);
    assert.equal((await missing.json()).error, "required_provider_permissions_not_verified_action_remains_paused");
  }, { managerOptions: { costPolicy: zeroCost } });

  await withServer(async (base, { projectService }) => {
    await projectService.connect("owner/app", "human-owner");
    const server = await createRequest(base);
    assert.equal(server.status, 201);
    const approval = (await server.json()).approval;
    const missingPermission = await postDecision(base, approval.id, "approve", "decision-missing-scope");
    assert.equal(missingPermission.status, 409);
    assert.equal((await missingPermission.json()).error, "required_provider_permissions_not_verified_action_remains_paused");
  }, { managerOptions: { costPolicy: zeroCost, permissionPolicy: async ({ project, service, actionType }) => ({ status: "verified", provider: service, project_id: project.id, action_type: actionType, verified_at: new Date().toISOString(), granted_permissions: ["repository read"], source: "provider_readback" }) } });

  await withServer(async (base, { projectService }) => {
    await projectService.connect("owner/app", "human-owner");
    const costMismatch = await createRequest(base, { key: "request-key-wrong-cost-scope" });
    assert.equal(((await costMismatch.json()).approval).cost.status, "unknown");
  }, { managerOptions: {
    costPolicy: async ({ service, actionType }) => ({ ...(await zeroCost({ project: { id: "some-other-project" }, service, actionType })) }),
  } });

  await withServer(async (base, { projectService }) => {
    await projectService.connect("owner/app", "human-owner");
    const permissionMismatch = await createRequest(base, { key: "request-key-wrong-perm-scope" });
    assert.equal(((await permissionMismatch.json()).approval.permission_check).status, "unknown");
  }, { managerOptions: { costPolicy: zeroCost, permissionPolicy: async ({ service, actionType, requestedPermissions }) => ({ status: "verified", provider: service, project_id: "some-other-project", action_type: actionType, verified_at: new Date().toISOString(), granted_permissions: requestedPermissions, source: "test_oauth_readback" }) } });

  await withServer(async (base, { projectService }) => {
    await projectService.connect("owner/app", "human-owner");
    const approval = (await (await createRequest(base, { key: "request-key-local-cancel" })).json()).approval;
    const cancel = await fetch(`${base}/api/automation/approvals/${encodeURIComponent(approval.id)}/cancel`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    assert.equal(cancel.status, 403);
  }, { provider: "local" });
});

test("approval inbox, reads, decisions and cancellation are limited to the original authenticated requester", async () => {
  await withServer(async (base, { projectService, setActor }) => {
    await projectService.connect("owner/app", "human-owner");
    const approval = (await (await createRequest(base, { key: "request-key-owner-scope" })).json()).approval;
    setActor("another-github-user");
    const inbox = await (await fetch(`${base}/api/automation/approvals`)).json();
    assert.equal(inbox.approvals.length, 0);
    const get = await fetch(`${base}/api/automation/approvals/${encodeURIComponent(approval.id)}`);
    assert.equal(get.status, 404);
    const decision = await postDecision(base, approval.id, "reject", "decision-other-user-01");
    assert.equal(decision.status, 403);
    const cancel = await fetch(`${base}/api/automation/approvals/${encodeURIComponent(approval.id)}/cancel`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    assert.equal(cancel.status, 403);
    const resume = await fetch(`${base}/api/automation/approvals/${encodeURIComponent(approval.id)}/resume`, { method: "POST" });
    assert.equal(resume.status, 403);
  });
});

test("approval and request idempotency prevent duplicate decisions and duplicate execution", async () => {
  await withServer(async (base, { projectService }) => {
    await projectService.connect("owner/app", "human-owner");
    const duplicateRequest = await createRequest(base);
    assert.equal(duplicateRequest.status, 201);
    const first = (await duplicateRequest.json()).approval;
    const duplicate = await createRequest(base);
    assert.equal(duplicate.status, 201);
    assert.equal((await duplicate.json()).approval.id, first.id);
    const decisionKey = "decision-once-0001";
    const approved = await postDecision(base, first.id, "approve", decisionKey);
    assert.equal(approved.status, 200);
    const approvedRecord = (await approved.json()).approval;
    assert.equal(approvedRecord.status, "awaiting_verification");
    assert.equal(approvedRecord.execution.attempts, 1);
    const repeated = await postDecision(base, first.id, "approve", decisionKey);
    assert.equal(repeated.status, 200);
    const repeatedRecord = (await repeated.json()).approval;
    assert.equal(repeatedRecord.status, "awaiting_verification");
    assert.equal(repeatedRecord.execution.attempts, 1);
    const stored = await projectService.getProjectData("owner/app");
    assert.equal(stored.approval_audit.filter((item) => item.event === "approve").length, 1);
    assert.equal(stored.approval_audit.filter((item) => item.event === "execution_started").length, 1);
  }, {
    managerOptions: {
      costPolicy: zeroCost,
      permissionPolicy: grantedPermissions,
      executors: new Map([["netlify", {
        supports: (type) => type === "netlify.link_repository",
        idempotencyMode: "provider_enforced", abortMode: "signal_supported",
        async execute({ idempotencyKey }) { return { status: "submitted", idempotency_key: idempotencyKey, reference: "deploy-ref-1" }; },
      }]]),
    },
  });
});

test("a separate provider readback is required before an action is marked succeeded", async () => {
  await withServer(async (base, { projectService }) => {
    await projectService.connect("owner/app", "human-owner");
    const approval = (await (await createRequest(base, { key: "request-key-verified" })).json()).approval;
    const response = await postDecision(base, approval.id, "approve", "decision-verified-01");
    const confirmed = (await response.json()).approval;
    assert.equal(response.status, 200);
    assert.equal(confirmed.status, "succeeded");
    assert.equal(confirmed.execution.evidence.source, "netlify_deploy_readback");
    assert.ok(Date.parse(confirmed.execution.evidence.verified_at));
  }, { managerOptions: {
    costPolicy: zeroCost,
    permissionPolicy: grantedPermissions,
    executors: new Map([["netlify", { supports: () => true, idempotencyMode: "provider_enforced", abortMode: "signal_supported", async execute({ idempotencyKey }) { return { status: "submitted", idempotency_key: idempotencyKey, reference: "deploy-ref-verified" }; } }]]),
    verifiers: new Map([["netlify", async ({ approval, receipt }) => ({ verified: true, provider: approval.service, project_id: approval.project_id, action_type: approval.action.type, verified_receipt_reference: receipt.reference, verified_at: new Date().toISOString(), reference: "deploy-confirmed-1", source: "netlify_deploy_readback" })]]),
  } });
});

test("provider verification cannot mark a different submitted receipt as succeeded", async () => {
  await withServer(async (base, { projectService }) => {
    await projectService.connect("owner/app", "human-owner");
    const approval = (await (await createRequest(base, { key: "request-key-verifier-binding" })).json()).approval;
    const response = await postDecision(base, approval.id, "approve", "decision-verifier-binding");
    const result = (await response.json()).approval;
    assert.equal(result.status, "awaiting_verification");
    assert.equal(result.execution.evidence, null);
  }, { managerOptions: {
    costPolicy: zeroCost,
    permissionPolicy: grantedPermissions,
    executors: new Map([["netlify", { supports: () => true, idempotencyMode: "provider_enforced", abortMode: "signal_supported", async execute({ idempotencyKey }) { return { status: "submitted", idempotency_key: idempotencyKey, reference: "submitted-action-A" }; } }]]),
    verifiers: new Map([["netlify", async ({ approval }) => ({ verified: true, provider: approval.service, project_id: approval.project_id, action_type: approval.action.type, verified_receipt_reference: "different-submitted-action", verified_at: new Date().toISOString(), reference: "verified-action-B", source: "netlify_deploy_readback" })]]),
  } });
});

test("unverified provider submissions become reconciliation-required after their verification deadline", async () => {
  let now = new Date();
  await withServer(async (base, { projectService }) => {
    await projectService.connect("owner/app", "human-owner");
    const approval = (await (await createRequest(base, { key: "request-key-verification-deadline" })).json()).approval;
    const response = await postDecision(base, approval.id, "approve", "decision-verification-deadline");
    const submitted = (await response.json()).approval;
    assert.equal(submitted.status, "awaiting_verification");
    assert.ok(Date.parse(submitted.execution.verification_deadline_at) > now.getTime());
    now = new Date(Date.parse(submitted.execution.verification_deadline_at) + 1);
    const inbox = await (await fetch(`${base}/api/automation/approvals`)).json();
    assert.equal(inbox.approvals[0].status, "execution_unknown");
    assert.equal(inbox.approvals[0].execution_status, "reconciliation_required");
    assert.ok(inbox.approvals[0].history.some((event) => event.event === "verification_overdue"));
  }, { managerOptions: {
    now: () => now,
    costPolicy: async (context) => {
      const proof = await zeroCost(context);
      proof.verified_at = now.toISOString();
      proof.free_quota.measured_at = now.toISOString();
      return proof;
    },
    permissionPolicy: async (context) => ({ ...(await grantedPermissions(context)), verified_at: now.toISOString() }),
    executors: new Map([["netlify", { supports: () => true, idempotencyMode: "provider_enforced", abortMode: "signal_supported", async execute({ idempotencyKey }) { return { status: "submitted", idempotency_key: idempotencyKey, reference: "verification-pending" }; } }]]),
  } });
});

test("rejection, more-information requests, defer, cancellation, and native approval isolation work", async () => {
  await withServer(async (base, { projectService }) => {
    await projectService.connect("owner/app", "human-owner");
    const created = await createRequest(base, { key: "request-key-actions" });
    const first = (await created.json()).approval;
    const moreInfo = await postDecision(base, first.id, "request_information", "decision-info-0001", { message: "Which repository permissions are strictly necessary?" });
    assert.equal((await moreInfo.json()).approval.status, "info_requested");
    const deferred = await postDecision(base, first.id, "defer", "decision-defer-001");
    assert.equal((await deferred.json()).approval.status, "deferred");
    const rejected = await postDecision(base, first.id, "reject", "decision-reject-01");
    assert.equal((await rejected.json()).approval.status, "rejected");

    const native = await fetch(`${base}/api/automation/approvals`, {
      method: "POST", headers: { "content-type": "application/json", "idempotency-key": "request-native-0001" },
      body: JSON.stringify({ project: "owner/app", service: "codex", action_type: "codex.native_approval", action_title: "Approve Codex", action_description: "Attempt native approval", reason: "Test" }),
    });
    assert.equal(native.status, 400);
    assert.equal((await native.json()).error, "native_codex_approval_must_use_codex_remote");

    const cancelTarget = (await (await createRequest(base, { key: "request-key-cancel" })).json()).approval;
    const cancel = await fetch(`${base}/api/automation/approvals/${encodeURIComponent(cancelTarget.id)}/cancel`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    assert.equal((await cancel.json()).approval.status, "cancelled");
  });
});

test("expired approvals become non-actionable and paid actions are blocked", async () => {
  let time = new Date("2026-11-16T12:00:00.000Z");
  await withServer(async (base, { projectService }) => {
    await projectService.connect("owner/app", "human-owner");
    const approval = (await (await createRequest(base, { key: "request-key-expiry", expires: 1 })).json()).approval;
    time = new Date("2026-11-16T13:00:01.000Z");
    const listed = await (await fetch(`${base}/api/automation/approvals`)).json();
    assert.equal(listed.approvals[0].status, "expired");
    const decision = await postDecision(base, approval.id, "reject", "decision-expired-01");
    assert.equal(decision.status, 409);
  }, { managerOptions: { now: () => time } });

  await withServer(async (base, { projectService }) => {
    await projectService.connect("owner/app", "human-owner");
    const response = await createRequest(base, { key: "request-key-paid-0001" });
    const request = (await response.json()).approval;
    assert.equal(request.status, "blocked_cost");
    const decision = await postDecision(base, request.id, "approve", "decision-paid-0001");
    assert.equal(decision.status, 409);
  }, { managerOptions: { costPolicy: async () => ({ status: "paid", one_time_eur: 1, recurring_eur: 0, source: "test_readback", verified_at: new Date().toISOString() }), permissionPolicy: grantedPermissions } });
});

test("approved requests expire before policy or executor calls can resume them", async () => {
  let time = new Date();
  let policyReads = 0;
  let executions = 0;
  const scopedCost = async ({ project, service, actionType }) => {
    policyReads += 1;
    const verifiedAt = time.toISOString();
    return { status: "verified_zero", provider: service, project_id: project.id, action_type: actionType, one_time_eur: 0, recurring_eur: 0, source: "test_provider_readback", verified_at: verifiedAt, free_quota: { status: "available", remaining_credits: 10, required_credits: 1, source: "test_quota_readback", measured_at: verifiedAt } };
  };
  const scopedPermissions = async ({ project, service, actionType, requestedPermissions }) => ({ status: "verified", provider: service, project_id: project.id, action_type: actionType, verified_at: time.toISOString(), granted_permissions: requestedPermissions, source: "test_oauth_readback" });
  await withServer(async (base, { projectService, approvalManager }) => {
    await projectService.connect("owner/app", "human-owner");
    const approval = (await (await createRequest(base, { key: "request-key-approved-expiry", expires: 1 })).json()).approval;
    const response = await postDecision(base, approval.id, "approve", "decision-await-executor-01");
    assert.equal((await response.json()).approval.status, "awaiting_executor");
    const readsBeforeExpiry = policyReads;
    time = new Date(Date.parse(approval.expires_at) + 1);
    const resumed = await approvalManager.resume(approval.id, { actor: "human-owner", authenticatedGithub: true });
    assert.equal(resumed.status, "expired");
    assert.equal(policyReads, readsBeforeExpiry);
    assert.equal(executions, 0);
  }, { managerOptions: { now: () => time, costPolicy: scopedCost, permissionPolicy: scopedPermissions } });
});

test("concurrent manager instances use the persisted transition to prevent duplicate provider execution", async () => {
  let executions = 0;
  const executor = { supports: () => true, idempotencyMode: "provider_enforced", abortMode: "signal_supported", async execute({ idempotencyKey }) {
    executions += 1;
    return { status: "submitted", idempotency_key: idempotencyKey, reference: "single-provider-action" };
  } };
  const managerOptions = { costPolicy: zeroCost, permissionPolicy: grantedPermissions, executors: new Map([["netlify", executor]]) };
  await withServer(async (base, { projectService }) => {
    await projectService.connect("owner/app", "human-owner");
    const approval = (await (await createRequest(base, { key: "request-key-multi-manager" })).json()).approval;
    await projectService.updateProjectData("owner/app", (data) => {
      const current = data.approvals.find((item) => item.id === approval.id);
      current.status = "approved";
      current.decision = { choice: "approve", actor: "human-owner", at: new Date().toISOString(), message: "", idempotency_key: "decision-preapproved-01" };
      return data;
    });
    const secondManager = new ApprovalManager({ projectService, ...managerOptions });
    const results = await Promise.all([
      new ApprovalManager({ projectService, ...managerOptions }).resume(approval.id, { actor: "human-owner", authenticatedGithub: true }),
      secondManager.resume(approval.id, { actor: "human-owner", authenticatedGithub: true }),
    ]);
    assert.equal(executions, 1);
    assert.ok(results.every((item) => ["executing", "awaiting_verification", "execution_unknown", "succeeded"].includes(item.status)), JSON.stringify(results.map((item) => item.status)));
  }, { managerOptions });
});

test("executor receipts must bind to the stable idempotency key and stale cost evidence stays blocked", async () => {
  await withServer(async (base, { projectService }) => {
    await projectService.connect("owner/app", "human-owner");
    const stale = await createRequest(base, { key: "request-key-stale-cost" });
    assert.equal(((await stale.json()).approval).cost.status, "unknown");
  }, { managerOptions: {
    costPolicy: async ({ project, service, actionType }) => {
      const proof = await zeroCost({ project, service, actionType });
      proof.verified_at = new Date(Date.now() - 60 * 60 * 1000 - 1).toISOString();
      return proof;
    },
  } });

  let executions = 0;
  await withServer(async (base, { projectService }) => {
    await projectService.connect("owner/app", "human-owner");
    const approval = (await (await createRequest(base, { key: "request-key-bad-receipt" })).json()).approval;
    const decision = await postDecision(base, approval.id, "approve", "decision-bad-receipt-01");
    const result = (await decision.json()).approval;
    assert.equal(result.status, "execution_unknown");
    assert.equal(executions, 1);
  }, { managerOptions: {
    costPolicy: zeroCost,
    permissionPolicy: grantedPermissions,
    executors: new Map([["netlify", { supports: () => true, idempotencyMode: "provider_enforced", abortMode: "signal_supported", async execute() { executions += 1; return { status: "submitted", idempotency_key: "wrong-key", reference: "receipt-key-mismatch" }; } }]]),
  } });
});

test("free quota must be fresh and sufficient again immediately before execution", async () => {
  let policyReads = 0;
  let executions = 0;
  const quotaPolicy = async (context) => {
    policyReads += 1;
    if (policyReads > 1) {
      const measuredAt = new Date().toISOString();
      return { status: "verified_zero", provider: context.service, project_id: context.project.id, action_type: context.actionType, one_time_eur: 0, recurring_eur: 0, source: "provider_billing_readback", verified_at: measuredAt, free_quota: { status: "exhausted", remaining_credits: 0, required_credits: 1, source: "provider_quota_readback", measured_at: measuredAt } };
    }
    return zeroCost(context);
  };
  await withServer(async (base, { projectService }) => {
    await projectService.connect("owner/app", "human-owner");
    const approval = (await (await createRequest(base, { key: "request-key-quota" })).json()).approval;
    const response = await postDecision(base, approval.id, "approve", "decision-quota-0001");
    const updated = (await response.json()).approval;
    assert.equal(updated.status, "blocked_cost");
    assert.equal(updated.cost.status, "quota_exhausted");
    assert.equal(executions, 0);
  }, { managerOptions: {
    costPolicy: quotaPolicy,
    permissionPolicy: grantedPermissions,
    executors: new Map([["netlify", { supports: () => true, idempotencyMode: "provider_enforced", abortMode: "signal_supported", async execute() { executions += 1; return { status: "submitted", reference: "unused" }; } }]]),
  } });
});

test("expired executing lease is reconciled to unknown instead of replayed", async () => {
  let now = new Date("2026-11-16T12:00:00.000Z");
  let executions = 0;
  await withServer(async (base, { projectService, approvalManager }) => {
    await projectService.connect("owner/app", "human-owner");
    const approval = (await (await createRequest(base, { key: "request-key-lease" })).json()).approval;
    await projectService.updateProjectData("owner/app", (data) => {
      const item = data.approvals.find((entry) => entry.id === approval.id);
      item.status = "executing";
      item.execution_status = "executing";
      item.execution.attempts = 1;
      item.execution.lease_expires_at = "2026-11-16T12:04:00.000Z";
      item.decision = { choice: "approve", actor: "human-owner", at: now.toISOString(), message: "", idempotency_key: "decision-lease-0001" };
      return data;
    });
    now = new Date("2026-11-16T12:06:00.000Z");
    const inbox = await (await fetch(`${base}/api/automation/approvals`)).json();
    assert.equal(inbox.approvals[0].status, "execution_unknown");
    const resume = await approvalManager.resume(approval.id, { actor: "human-owner", authenticatedGithub: true });
    assert.equal(resume.status, "execution_unknown");
    assert.equal(executions, 0);
  }, { managerOptions: {
    now: () => now,
    costPolicy: async ({ project, service, actionType }) => ({ status: "verified_zero", provider: service, project_id: project.id, action_type: actionType, one_time_eur: 0, recurring_eur: 0, source: "test", verified_at: "2026-11-16T12:00:00.000Z", free_quota: { status: "available", remaining_credits: 2, required_credits: 1, source: "test", measured_at: "2026-11-16T12:00:00.000Z" } }),
    permissionPolicy: grantedPermissions,
    executors: new Map([["netlify", { supports: () => true, idempotencyMode: "provider_enforced", abortMode: "signal_supported", async execute() { executions += 1; return { status: "submitted", reference: "must-not-run" }; } }]]),
  } });
});

test("a long-running provider call renews its persisted lease for other manager instances", async () => {
  let now = new Date("2026-11-16T12:00:00.000Z");
  let signalStarted;
  let finishExecution;
  let executionKey;
  const started = new Promise((resolveStarted) => { signalStarted = resolveStarted; });
  const result = new Promise((resolveExecution) => { finishExecution = resolveExecution; });
  const wait = (duration) => new Promise((resolveWait) => setTimeout(resolveWait, duration));
  const costPolicy = async (context) => {
    const proof = await zeroCost(context);
    proof.verified_at = now.toISOString();
    proof.free_quota.measured_at = now.toISOString();
    return proof;
  };
  const permissionPolicy = async (context) => ({ ...(await grantedPermissions(context)), verified_at: now.toISOString() });
  await withServer(async (base, { projectService }) => {
    await projectService.connect("owner/app", "human-owner");
    const approval = (await (await createRequest(base, { key: "request-key-long-run" })).json()).approval;
    const decisionPromise = postDecision(base, approval.id, "approve", "decision-long-running-01");
    await started;
    await wait(30);
    now = new Date("2026-11-16T12:00:00.090Z");
    await wait(30);
    now = new Date("2026-11-16T12:00:00.130Z");
    const observer = new ApprovalManager({ projectService, now: () => now, executionLeaseMs: 120, executionLeaseRenewalMs: 20 });
    const observed = await observer.list({ actor: "human-owner" });
    assert.equal(observed[0].status, "executing");
    assert.ok(Date.parse(observed[0].execution.lease_expires_at) > now.getTime());
    finishExecution({ status: "submitted", idempotency_key: executionKey, reference: "long-running-provider-operation" });
    const response = await decisionPromise;
    assert.equal((await response.json()).approval.status, "awaiting_verification");
  }, { managerOptions: {
    now: () => now,
    executionLeaseMs: 120,
    executionLeaseRenewalMs: 20,
    costPolicy,
    permissionPolicy,
    executors: new Map([["netlify", { supports: () => true, idempotencyMode: "provider_enforced", abortMode: "signal_supported", async execute({ idempotencyKey }) { executionKey = idempotencyKey; signalStarted(); return result; } }]]),
  } });
});

test("lease renewal failure aborts the adapter signal and leaves an auditable unknown result", async () => {
  let aborted = false;
  let failNextWrite = false;
  await withServer(async (base, { projectService }) => {
    await projectService.connect("owner/app", "human-owner");
    const originalUpdate = projectService.updateProjectData.bind(projectService);
    projectService.updateProjectData = (...args) => {
      if (failNextWrite) {
        failNextWrite = false;
        throw new Error("private provider error must not escape");
      }
      return originalUpdate(...args);
    };
    const approval = (await (await createRequest(base, { key: "request-key-renewal-failure" })).json()).approval;
    const response = await postDecision(base, approval.id, "approve", "decision-renewal-failure");
    const result = (await response.json()).approval;
    assert.equal(result.status, "execution_unknown");
    assert.equal(aborted, true);
    assert.ok(result.history.some((event) => event.event === "execution_lease_renewal_failed"));
  }, { managerOptions: {
    executionLeaseMs: 120,
    executionLeaseRenewalMs: 20,
    costPolicy: zeroCost,
    permissionPolicy: grantedPermissions,
    executors: new Map([["netlify", {
      supports: () => true, idempotencyMode: "provider_enforced", abortMode: "signal_supported",
      async execute({ signal }) {
        failNextWrite = true;
        signal.addEventListener("abort", () => { aborted = true; });
        return new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true }));
      },
    }]]),
  } });
});

test("in-flight provider action cannot be cancelled while its outcome is unresolved", async () => {
  let markStarted;
  let finishExecution;
  let executionKey;
  const started = new Promise((resolveStarted) => { markStarted = resolveStarted; });
  const executionResult = new Promise((resolveExecution) => { finishExecution = resolveExecution; });
  await withServer(async (base, { projectService }) => {
    await projectService.connect("owner/app", "human-owner");
    const approval = (await (await createRequest(base, { key: "request-key-running" })).json()).approval;
    const decisionPromise = postDecision(base, approval.id, "approve", "decision-running-001");
    await started;
    const cancel = await fetch(`${base}/api/automation/approvals/${encodeURIComponent(approval.id)}/cancel`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    assert.equal(cancel.status, 409);
    finishExecution({ status: "submitted", idempotency_key: executionKey, reference: "in-flight-result" });
    const response = await decisionPromise;
    assert.equal((await response.json()).approval.status, "awaiting_verification");
  }, { managerOptions: {
    costPolicy: zeroCost,
    permissionPolicy: grantedPermissions,
    executors: new Map([["netlify", { supports: () => true, idempotencyMode: "provider_enforced", abortMode: "signal_supported", async execute({ idempotencyKey }) { executionKey = idempotencyKey; markStarted(); return executionResult; } }]]),
  } });
});

test("interrupted executor becomes unknown and cannot be retried or duplicated", async () => {
  const runCounter = { count: 0 };
  await withServer(async (base, { projectService, approvalManager }) => {
    await projectService.connect("owner/app", "human-owner");
    const approval = (await (await createRequest(base, { key: "request-key-interrupt-2" })).json()).approval;
    const decided = await postDecision(base, approval.id, "approve", "decision-interrupt-01");
    assert.equal((await decided.json()).approval.status, "execution_unknown");
    const resumed = await approvalManager.resume(approval.id, { actor: "human-owner", authenticatedGithub: true });
    assert.equal(resumed.status, "execution_unknown");
    assert.equal(runCounter.count, 1);
  }, { managerOptions: {
    costPolicy: zeroCost,
    permissionPolicy: grantedPermissions,
    executors: new Map([["netlify", {
      supports: () => true,
      idempotencyMode: "provider_enforced", abortMode: "signal_supported",
      async execute() { runCounter.count += 1; throw new Error("connection lost"); },
    }]]),
  } });
});

test("PWA contains a mobile approvals inbox and does not claim a configured provider runner", async () => {
  const html = await readFile(resolve("src/pwa/index.html"), "utf8");
  const js = await readFile(resolve("src/pwa/app.js"), "utf8");
  assert.match(html, /Automatisierung &amp; Freigaben/);
  assert.match(html, /Push ist nicht eingerichtet/);
  assert.match(js, /Native Codex-Freigaben werden ausschließlich in Codex Remote beantwortet/);
  assert.match(js, /Kosten nicht verifiziert — Ausführung bleibt gesperrt/);
});
