import { sha256Hex } from "../security/web-crypto.mjs";

const MAX_STRATEGIES_PER_PROJECT = 100;
const SECRET_PATTERNS = [
  /gh[pousr]_[A-Za-z0-9_]{20,}/i,
  /github_pat_[A-Za-z0-9_]{20,}/i,
  /-----BEGIN [A-Z ]+ PRIVATE KEY-----/,
  /(?:password|secret|api[_-]?key|access[_-]?token)\s*[:=]\s*[^\s]+/i,
];

function safeText(value, field, max = 4000) {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > max) throw new Error(`${field} is invalid`);
  if (SECRET_PATTERNS.some((pattern) => pattern.test(value))) throw new Error(`${field} appears to contain a secret`);
  return value.trim();
}

function safeActor(value) {
  const login = safeText(value, "actor", 39);
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(login)) throw new Error("actor identity is invalid");
  return login;
}

function entryBody(entry) {
  const { digest, ...body } = entry;
  return body;
}

function hasIndependentReviewer(evidence, proposer) {
  const excluded = new Set([evidence.pull_request_author?.toLowerCase(), proposer.toLowerCase()]);
  return Array.isArray(evidence.independent_reviewers)
    && evidence.review_list_complete === true
    && evidence.independent_reviewers.some((review) => typeof review?.login === "string" && !excluded.has(review.login.toLowerCase()));
}

async function seal(entry) {
  return { ...entry, digest: await sha256Hex(JSON.stringify(entryBody(entry))) };
}

async function validateEntries(value, projectId) {
  if (!Array.isArray(value) || value.length > MAX_STRATEGIES_PER_PROJECT) throw new Error("strategy collection is invalid; refusing to overwrite it");
  for (const entry of value) {
    if (!entry || entry.schema_version !== 1 || entry.project_id !== projectId || typeof entry.id !== "string" || !/^strategy_[0-9a-f-]{36}$/i.test(entry.id) || !["awaiting_approval", "adopted"].includes(entry.status) || typeof entry.critical !== "boolean" || entry.critical !== (entry.evidence?.critical === true) || entry.outcome !== "success" || !Number.isFinite(Date.parse(entry.created_at)) || !/^[a-f0-9]{64}$/i.test(entry.digest ?? "") || !/^[a-f0-9]{64}$/i.test(entry.evidence_digest ?? "")) {
      throw new Error("strategy record is invalid; refusing to use it");
    }
    safeText(entry.name, "strategy name", 300);
    safeText(entry.hypothesis, "strategy hypothesis");
    safeActor(entry.proposed_by);
    if (entry.evidence?.schema_version !== 1 || entry.evidence.project_id !== projectId || entry.evidence.source !== "github_pull_request_and_actions_api" || entry.evidence.verified !== true || entry.evidence.critical !== entry.critical || await sha256Hex(JSON.stringify(entry.evidence)) !== entry.evidence_digest || await sha256Hex(JSON.stringify(entryBody(entry))) !== entry.digest) {
      throw new Error("strategy evidence digest does not match; refusing to use it");
    }
    if (entry.critical && (typeof entry.evidence.pull_request_author !== "string" || !Array.isArray(entry.evidence.independent_reviewers) || typeof entry.evidence.review_list_complete !== "boolean")) {
      throw new Error("critical strategy review evidence is invalid; refusing to use it");
    }
    if (entry.critical && entry.status === "awaiting_approval" && (entry.adopted_by !== null || entry.adopted_at !== null || entry.approved_by !== null || entry.approved_at !== null)) throw new Error("unapproved strategy contains adoption data; refusing to use it");
    if (entry.critical && entry.status === "adopted") {
      const approver = safeActor(entry.approved_by);
      if (entry.adopted_by !== approver || !Number.isFinite(Date.parse(entry.approved_at ?? "")) || !Number.isFinite(Date.parse(entry.adopted_at ?? "")) || approver.toLowerCase() === entry.proposed_by.toLowerCase() || approver.toLowerCase() === entry.evidence.pull_request_author.toLowerCase() || entry.evidence.file_list_complete !== true || entry.evidence.file_list_valid !== true || !Number.isSafeInteger(entry.evidence.changed_file_count) || entry.evidence.changed_file_count < 1 || !hasIndependentReviewer(entry.evidence, entry.proposed_by)) {
        throw new Error("critical strategy approval is invalid; refusing to use it");
      }
    }
    if (!entry.critical && (entry.status !== "adopted" || entry.adopted_by !== "verified-ci-engine" || !Number.isFinite(Date.parse(entry.adopted_at ?? "")) || entry.approved_by !== null || entry.approved_at !== null)) throw new Error("noncritical strategy adoption is invalid; refusing to use it");
  }
  return value;
}

export class StrategyLearningEngine {
  constructor({ projectService, now = () => new Date() } = {}) {
    if (!projectService || typeof projectService.verifyStrategyEvidence !== "function" || typeof projectService.getProjectData !== "function" || typeof projectService.updateProjectData !== "function") {
      throw new Error("project service with verified strategy evidence and atomic project storage is required");
    }
    this.projectService = projectService;
    this.now = now;
  }

  async list(projectId) {
    const project = await this.projectService.get(projectId);
    if (!project || project.status !== "connected") throw Object.assign(new Error("project is not connected"), { statusCode: 409 });
    const data = await this.projectService.getProjectData(project.id);
    const entries = data.strategy_evaluations ?? [];
    await validateEntries(entries, project.id);
    return structuredClone(entries);
  }

  async evaluate(projectId, { name, hypothesis, pullRequestNumber, workflowRunId } = {}, actor) {
    const proposer = safeActor(actor);
    const project = await this.projectService.get(projectId);
    if (!project || project.status !== "connected") throw Object.assign(new Error("project is not connected"), { statusCode: 409 });
    const evidence = await this.projectService.verifyStrategyEvidence(project.id, { pullRequestNumber, workflowRunId, checkName: "test" });
    const evidenceDigest = await sha256Hex(JSON.stringify(evidence));
    const critical = evidence.critical === true;
    const base = {
      schema_version: 1,
      id: `strategy_${globalThis.crypto.randomUUID()}`,
      project_id: project.id,
      name: safeText(name, "strategy name", 300),
      hypothesis: safeText(hypothesis, "strategy hypothesis"),
      outcome: "success",
      evidence,
      evidence_digest: evidenceDigest,
      critical,
      status: critical ? "awaiting_approval" : "adopted",
      proposed_by: proposer,
      adopted_by: critical ? null : "verified-ci-engine",
      adopted_at: critical ? null : this.now().toISOString(),
      approved_by: null,
      approved_at: null,
      created_at: this.now().toISOString(),
    };
    const entry = await seal(base);
    let saved = null;
    await this.projectService.updateProjectData(project.id, async (data) => {
      const entries = await validateEntries(data.strategy_evaluations ?? [], project.id);
      const duplicate = entries.find((item) => item.name === entry.name && item.evidence_digest === entry.evidence_digest);
      if (duplicate) {
        saved = structuredClone(duplicate);
        return data;
      }
      if (entries.length >= MAX_STRATEGIES_PER_PROJECT) throw new Error("project strategy history limit reached");
      saved = entry;
      return { ...data, strategy_evaluations: [...entries, entry] };
    });
    return structuredClone(saved);
  }

  async adopt(projectId, strategyId, { confirmation, actor, authenticatedGithub = false } = {}) {
    const approver = safeActor(actor);
    const project = await this.projectService.get(projectId);
    if (!project || project.status !== "connected") throw Object.assign(new Error("project is not connected"), { statusCode: 409 });
    const entries = await this.list(project.id);
    const current = entries.find((item) => item.id === strategyId);
    if (!current) throw Object.assign(new Error("strategy evaluation not found"), { statusCode: 404 });
    if (!current.critical || current.status !== "awaiting_approval") throw Object.assign(new Error("strategy is not awaiting critical approval"), { statusCode: 409 });
    if (confirmation !== `ADOPT STRATEGY ${current.id}`) throw Object.assign(new Error(`type ADOPT STRATEGY ${current.id} to confirm`), { statusCode: 400 });
    if (authenticatedGithub !== true) throw Object.assign(new Error("critical strategy adoption requires an authenticated GitHub user"), { statusCode: 403 });
    if (approver.toLowerCase() === current.proposed_by.toLowerCase() || approver.toLowerCase() === current.evidence.pull_request_author.toLowerCase()) {
      throw Object.assign(new Error("strategy proposer and pull request author cannot approve this critical strategy"), { statusCode: 403 });
    }

    let adopted = null;
    await this.projectService.updateProjectData(project.id, async (data) => {
      const latest = await validateEntries(data.strategy_evaluations ?? [], project.id);
      const entry = latest.find((item) => item.id === current.id);
      if (!entry || entry.digest !== current.digest || entry.status !== "awaiting_approval") throw Object.assign(new Error("strategy changed after review; reload and review the current version"), { statusCode: 409 });
      const evidence = await this.projectService.verifyStrategyEvidence(project.id, {
        pullRequestNumber: entry.evidence.pull_request_number,
        workflowRunId: entry.evidence.workflow_run_id,
        checkName: entry.evidence.check_name,
      });
      if (await sha256Hex(JSON.stringify(evidence)) !== entry.evidence_digest || evidence.critical !== true || evidence.file_list_complete !== true || evidence.file_list_valid !== true || evidence.changed_file_count < 1 || !hasIndependentReviewer(evidence, entry.proposed_by)) {
        throw Object.assign(new Error("critical strategy requires a complete valid file list, current matching CI evidence, and an independent approved review"), { statusCode: 409 });
      }
      const next = await seal({ ...entry, status: "adopted", adopted_by: approver, adopted_at: this.now().toISOString(), approved_by: approver, approved_at: this.now().toISOString() });
      adopted = next;
      return { ...data, strategy_evaluations: latest.map((item) => item.id === entry.id ? next : item) };
    });
    return structuredClone(adopted);
  }
}
