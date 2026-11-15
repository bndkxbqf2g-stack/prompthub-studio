import { validateJobInput } from "../domain/job.mjs";
import { sha256Hex } from "../security/web-crypto.mjs";
import { FAILURE_PATTERN_NAMES } from "./failure-classifier.mjs";

const MAX_INCIDENTS_PER_PROJECT = 500;
const MAX_INCIDENT_HISTORY = 40;
const MAX_HYPOTHESES_PER_INCIDENT = 20;
const MAX_VERIFIED_OUTCOMES = 200;
const CATEGORIES = new Set(["user_reported", "required_check_failed", "executor_failed", "runner_failed"]);
const FAILURE_STAGES = new Set(["checks", "execute", "runner"]);
const HYPOTHESIS_ACTIONS = new Set(["repeated_failure_observed", "runner_failure_observed", "user_symptom_reported", "cause_hypothesis_added", "cause_human_confirmed"]);

function safeText(value, field, max = 1500) {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > max) throw new Error(`${field} is invalid`);
  validateJobInput({ prompt: value, project: "owner/incident", priority: 50 });
  return value.trim();
}

function safeComponents(components = []) {
  if (!Array.isArray(components) || components.length > 20) throw new Error("incident components are invalid");
  return [...new Set(components.map((component) => {
    if (typeof component !== "string" || component.length > 200 || !/^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/.test(component) || component.split("/").some((part) => part === "." || part === "..")) {
      throw new Error("component references must be repository-relative paths");
    }
    return component;
  }))];
}

function safeActor(actor) {
  if (typeof actor !== "string" || !/^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/.test(actor)) throw new Error("incident actor is invalid");
  return actor;
}

function recordBody(record) {
  const { digest, ...body } = record;
  return body;
}

async function seal(record) {
  record.digest = await sha256Hex(JSON.stringify(recordBody(record)));
  return record;
}

function validTime(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function validateEvidenceRef(ref) {
  if (!ref || typeof ref !== "object" || typeof ref.job_id !== "string" || !/^job_[A-Za-z0-9-]{1,100}$/.test(ref.job_id) || !validTime(ref.completed_at)) throw new Error("incident evidence reference is invalid; refusing to use it");
  if (ref.completion_event_id !== undefined && (typeof ref.completion_event_id !== "string" || !/^evt_[A-Za-z0-9-]{1,100}$/.test(ref.completion_event_id))) throw new Error("incident event reference is invalid; refusing to use it");
  if (ref.evidence_level !== undefined && !["required_checks_passed", "required_checks_failed", "executor_or_runner_failure"].includes(ref.evidence_level)) throw new Error("incident evidence level is invalid; refusing to use it");
}

function validateHypothesis(item) {
  if (!item || typeof item !== "object" || typeof item.id !== "string" || !/^hypothesis_[A-Za-z0-9-]{1,100}$/.test(item.id) || !["hypothesis", "human_confirmed"].includes(item.status) || !validTime(item.created_at)) throw new Error("incident hypothesis is invalid; refusing to use it");
  safeText(item.summary, "cause hypothesis");
  if (item.approach) safeText(item.approach, "approach", 800);
  safeComponents(item.components);
  safeActor(item.created_by);
  if (!Array.isArray(item.evidence_refs) || item.evidence_refs.length > 10) throw new Error("hypothesis evidence is invalid; refusing to use it");
  for (const ref of item.evidence_refs) {
    validateEvidenceRef(ref);
    if (!["success", "checks_failed", "execution_failed_before_checks"].includes(ref.outcome) || !Array.isArray(ref.check_names) || ref.check_names.length > 30) throw new Error("hypothesis evidence is invalid; refusing to use it");
    for (const name of ref.check_names) safeText(name, "check name", 160);
  }
  if (item.status === "human_confirmed") {
    safeActor(item.confirmed_by);
    if (!validTime(item.confirmed_at)) throw new Error("hypothesis confirmation is invalid; refusing to use it");
  }
}

async function validateIncident(item, projectId) {
  if (!item || typeof item !== "object" || item.schema_version !== 1 || item.project_id !== projectId || typeof item.id !== "string" || !/^incident_[A-Za-z0-9-]{1,100}$/.test(item.id) || !Number.isInteger(item.version) || item.version < 1 || !["runner_outcome", "user_report"].includes(item.source) || !["unknown", "hypothesis", "human_confirmed"].includes(item.cause_status) || !Number.isSafeInteger(item.occurrence_count) || item.occurrence_count < 1 || !validTime(item.created_at) || !validTime(item.updated_at)) {
    throw new Error("incident record is invalid; refusing to use it");
  }
  if (item.signature !== null && (typeof item.signature !== "string" || !/^[a-f0-9]{64}$/.test(item.signature))) throw new Error("incident signature is invalid; refusing to use it");
  if (item.source === "runner_outcome" && !item.signature) throw new Error("runner incident signature is missing; refusing to use it");
  if ((item.source === "user_report" && (item.symptom?.category !== "user_reported" || item.signature !== null)) || (item.source === "runner_outcome" && item.symptom?.category === "user_reported")) throw new Error("incident source and symptom classification conflict; refusing to use it");
  if (!item.symptom || typeof item.symptom !== "object" || !CATEGORIES.has(item.symptom.category) || !validTime(item.symptom.observed_at) || (item.symptom.failure_stage !== null && !FAILURE_STAGES.has(item.symptom.failure_stage)) || !Array.isArray(item.symptom.check_names) || item.symptom.check_names.length > 30 || !Array.isArray(item.symptom.failure_patterns) || item.symptom.failure_patterns.length > 8 || item.symptom.failure_patterns.some((pattern) => !FAILURE_PATTERN_NAMES.includes(pattern))) throw new Error("incident symptom is invalid; refusing to use it");
  if (item.symptom.summary !== undefined) safeText(item.symptom.summary, "symptom report");
  for (const name of item.symptom.check_names) safeText(name, "check name", 160);
  safeComponents(item.components);
  if (!Array.isArray(item.evidence_refs) || item.evidence_refs.length > MAX_VERIFIED_OUTCOMES || !Array.isArray(item.hypotheses) || item.hypotheses.length > MAX_HYPOTHESES_PER_INCIDENT || !Array.isArray(item.history) || item.history.length > MAX_INCIDENT_HISTORY) throw new Error("incident collections are invalid; refusing to use them");
  for (const ref of item.evidence_refs) validateEvidenceRef(ref);
  for (const hypothesis of item.hypotheses) validateHypothesis(hypothesis);
  for (const event of item.history) {
    if (!event || !Number.isInteger(event.version) || event.version < 1 || !HYPOTHESIS_ACTIONS.has(event.action) || !validTime(event.created_at) || !Array.isArray(event.evidence_job_ids) || event.evidence_job_ids.length > 10) throw new Error("incident history is invalid; refusing to use it");
    if (event.actor === "runner") { /* deterministic runner observation */ } else safeActor(event.actor);
    safeText(event.summary, "history summary", 500);
    for (const jobId of event.evidence_job_ids) if (typeof jobId !== "string" || !/^job_[A-Za-z0-9-]{1,100}$/.test(jobId)) throw new Error("incident history reference is invalid; refusing to use it");
  }
  if (item.cause_status === "human_confirmed") {
    const cause = item.confirmed_cause;
    if (!cause || typeof cause !== "object" || typeof cause.hypothesis_id !== "string" || cause.same_change_verified !== true || !validTime(cause.confirmed_at) || !Array.isArray(cause.evidence_job_ids) || cause.evidence_job_ids.length !== 2 || !Array.isArray(cause.regression_checks) || cause.regression_checks.length > 30) throw new Error("confirmed cause is invalid; refusing to use it");
    safeText(cause.summary, "confirmed cause");
    safeActor(cause.confirmed_by);
    for (const jobId of cause.evidence_job_ids) if (typeof jobId !== "string" || !/^job_[A-Za-z0-9-]{1,100}$/.test(jobId)) throw new Error("confirmed cause evidence is invalid; refusing to use it");
    for (const name of cause.regression_checks) safeText(name, "regression check", 160);
    if (cause.ineffective_approach !== null) safeText(cause.ineffective_approach, "ineffective approach", 800);
    if (!item.hypotheses.some((hypothesis) => hypothesis.id === cause.hypothesis_id && hypothesis.status === "human_confirmed")) throw new Error("confirmed cause has no confirmed hypothesis; refusing to use it");
  } else if (item.confirmed_cause !== null) throw new Error("unconfirmed incident contains a confirmed cause; refusing to use it");
  if ((item.cause_status === "hypothesis" && !item.hypotheses.some((hypothesis) => hypothesis.status === "hypothesis")) || (item.cause_status === "unknown" && item.hypotheses.some((hypothesis) => hypothesis.status !== "hypothesis"))) throw new Error("incident hypothesis status is inconsistent; refusing to use it");
  if (item.source === "runner_outcome" && (item.occurrence_count < item.evidence_refs.length || !item.evidence_refs.length)) throw new Error("runner incident count and evidence conflict; refusing to use it");
  if (item.source === "user_report" && item.occurrence_count !== 1) throw new Error("user report occurrence count is invalid; refusing to use it");
  if (!/^[a-f0-9]{64}$/.test(item.digest ?? "") || await sha256Hex(JSON.stringify(recordBody(item))) !== item.digest) throw new Error("incident digest does not match; refusing to use it");
}

function addHistory(record, { action, actor, summary, evidenceJobIds = [], now }) {
  record.version += 1;
  record.updated_at = now.toISOString();
  record.history = [...record.history, {
    version: record.version,
    action,
    actor,
    summary: String(summary).slice(0, 500),
    evidence_job_ids: evidenceJobIds.slice(0, 10),
    created_at: record.updated_at,
  }].slice(-MAX_INCIDENT_HISTORY);
}

function projectKey(projectId) {
  if (typeof projectId !== "string" || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(projectId)) throw new Error("project must use owner/name form");
  return projectId.toLowerCase();
}

export class ErrorLearningEngine {
  constructor({ projectService, now = () => new Date() } = {}) {
    if (!projectService) throw new Error("projectService is required");
    this.projectService = projectService;
    this.now = now;
  }

  async assertConnected(input) {
    const id = projectKey(input);
    const project = await this.projectService.get(id);
    if (!project || project.status !== "connected") throw Object.assign(new Error("project_not_connected_for_error_learning"), { statusCode: 409 });
    return id;
  }

  async validateCollection(data, projectId) {
    if (data.incidents === undefined) return [];
    if (!Array.isArray(data.incidents) || data.incidents.length > MAX_INCIDENTS_PER_PROJECT) throw new Error("incident history is invalid; refusing to use it");
    const seen = new Set();
    for (const item of data.incidents) {
      await validateIncident(item, projectId);
      if (seen.has(item.id)) throw new Error("incident IDs are duplicated; refusing to use history");
      seen.add(item.id);
    }
    if (data.incidents.some((item) => item.evidence_refs.length || item.hypotheses.some((hypothesis) => hypothesis.evidence_refs.length) || item.confirmed_cause)) {
      const outcomes = await this.projectService.listVerifiedOutcomes(projectId, { limit: MAX_VERIFIED_OUTCOMES });
      const byJob = new Map(outcomes.map((item) => [item.job_id, item]));
      for (const incident of data.incidents) {
        for (const ref of incident.evidence_refs) {
          const outcome = byJob.get(ref.job_id);
          if (!outcome) continue; // Older verified outcomes can age out of the bounded 200-entry active cache.
          if (outcome.completed_at !== ref.completed_at || (ref.completion_event_id && outcome.completion_event_id !== ref.completion_event_id) || (ref.evidence_level && outcome.evidence_level !== ref.evidence_level)) throw new Error("incident evidence does not match verified project outcomes; refusing to use it");
          if (incident.source === "runner_outcome" && (outcome.job_status !== "failed" || outcome.required_checks.names.join("\n") !== incident.symptom.check_names.join("\n"))) throw new Error("runner incident evidence conflicts with failed checks; refusing to use it");
        }
        for (const hypothesis of incident.hypotheses) {
          for (const ref of hypothesis.evidence_refs) {
            const outcome = byJob.get(ref.job_id);
            if (!outcome) continue;
            if (outcome.completed_at !== ref.completed_at || outcome.outcome !== ref.outcome || outcome.required_checks.names.join("\n") !== ref.check_names.join("\n")) throw new Error("hypothesis evidence does not match verified project outcomes; refusing to use it");
          }
        }
        if (incident.confirmed_cause) {
          const [failedId, correctedId] = incident.confirmed_cause.evidence_job_ids;
          const failed = byJob.get(failedId);
          const corrected = byJob.get(correctedId);
          const matching = failed?.required_checks.names.filter((name) => corrected?.required_checks.names.includes(name)) ?? [];
          const hypothesis = incident.hypotheses.find((item) => item.id === incident.confirmed_cause.hypothesis_id);
          if ((failed && failed.outcome !== "checks_failed") || (corrected && corrected.outcome !== "success") || (failed && corrected && (Date.parse(corrected.completed_at) <= Date.parse(failed.completed_at) || matching.join("\n") !== incident.confirmed_cause.regression_checks.join("\n"))) || !hypothesis?.evidence_refs.some((ref) => ref.job_id === failedId && ref.outcome === "checks_failed")) throw new Error("confirmed cause does not match verified failure and correction evidence; refusing to use it");
        }
      }
    }
    return data.incidents;
  }

  async readIncidents(input) {
    const projectId = await this.assertConnected(input);
    const data = await this.projectService.getProjectData(projectId);
    return this.validateCollection(data, projectId);
  }

  async list(projectId, { limit = 50 } = {}) {
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_INCIDENTS_PER_PROJECT) throw new Error(`incident limit must be between 1 and ${MAX_INCIDENTS_PER_PROJECT}`);
    const id = await this.assertConnected(projectId);
    const data = await this.projectService.getProjectData(id);
    const incidents = await this.validateCollection(data, id);
    const relevant = incidents.slice().sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, limit);
    const hasRefs = relevant.some((item) => item.evidence_refs.length || item.hypotheses.some((hypothesis) => hypothesis.evidence_refs.length) || item.confirmed_cause);
    const available = hasRefs ? new Set((await this.projectService.listVerifiedOutcomes(id, { limit: MAX_VERIFIED_OUTCOMES })).map((item) => item.job_id)) : new Set();
    return structuredClone(relevant.map((item) => {
      const causeRefs = item.confirmed_cause?.evidence_job_ids ?? [];
      const hasCauseEvidence = causeRefs.length === 2 && causeRefs.every((jobId) => available.has(jobId));
      const hasRunnerEvidence = item.source === "runner_outcome" && item.evidence_refs.some((ref) => available.has(ref.job_id));
      const hasReportedEvidence = item.source === "user_report" && item.evidence_refs.some((ref) => available.has(ref.job_id));
      return { ...item, verified_evidence_available: item.cause_status === "human_confirmed" ? hasCauseEvidence : hasRunnerEvidence || hasReportedEvidence };
    }));
  }

  async observeVerifiedOutcome(outcome) {
    if (outcome?.job_status !== "failed") return null;
    const projectId = await this.assertConnected(outcome.project_id);
    const verified = (await this.projectService.listVerifiedOutcomes(projectId, { limit: MAX_VERIFIED_OUTCOMES })).find((item) => item.id === outcome.id && item.evidence_digest === outcome.evidence_digest);
    if (!verified || verified.job_status !== "failed") throw new Error("failure observation requires verified project outcome evidence");
    const checkNames = verified.required_checks?.names ?? [];
    const failurePatterns = verified.failure_patterns ?? ["unclassified"];
    const category = checkNames.length ? "required_check_failed" : verified.failure_stage === "execute" ? "executor_failed" : "runner_failed";
    const signature = await sha256Hex(JSON.stringify({ projectId, category, failure_stage: verified.failure_stage, checkNames: [...checkNames].sort(), failurePatterns: [...failurePatterns].sort() }));
    let observed = null;
    await this.projectService.updateProjectData(projectId, async (data) => {
      const incidents = await this.validateCollection(data, projectId);
      const existing = incidents.find((item) => item.signature === signature && item.source === "runner_outcome");
      if (existing) {
        if (existing.evidence_refs.some((ref) => ref.job_id === verified.job_id)) {
          observed = existing;
          return data;
        }
        existing.occurrence_count += 1;
        existing.evidence_refs = [...existing.evidence_refs, { job_id: verified.job_id, completion_event_id: verified.completion_event_id, completed_at: verified.completed_at }].slice(-MAX_VERIFIED_OUTCOMES);
        addHistory(existing, { action: "repeated_failure_observed", actor: "runner", summary: category, evidenceJobIds: [verified.job_id], now: this.now() });
        await seal(existing);
        observed = existing;
        return { ...data, incidents };
      }
      const createdAt = verified.completed_at;
      const incident = {
        schema_version: 1,
        id: `incident_${globalThis.crypto.randomUUID()}`,
        project_id: projectId,
        source: "runner_outcome",
        signature,
        symptom: { category, failure_stage: verified.failure_stage, check_names: checkNames.slice(0, 30), failure_patterns: failurePatterns.slice(0, 8), observed_at: createdAt },
        cause_status: "unknown",
        hypotheses: [],
        confirmed_cause: null,
        components: [],
        occurrence_count: 1,
        evidence_refs: [{ job_id: verified.job_id, completion_event_id: verified.completion_event_id, completed_at: createdAt }],
        version: 1,
        created_at: createdAt,
        updated_at: createdAt,
        history: [{ version: 1, action: "runner_failure_observed", actor: "runner", summary: category, evidence_job_ids: [verified.job_id], created_at: createdAt }],
      };
      await seal(incident);
      observed = incident;
      return { ...data, incidents: [...incidents, incident].slice(-MAX_INCIDENTS_PER_PROJECT) };
    });
    return observed ? structuredClone(observed) : null;
  }

  async recordVerifiedJobOutcome(jobId) {
    const result = await this.projectService.recordVerifiedJobOutcome(jobId);
    const incident = await this.observeVerifiedOutcome(result.outcome);
    return { ...result, ...(incident ? { incident } : {}) };
  }

  async report(projectId, { summary, components = [], relatedJobId = null } = {}, actor) {
    const id = await this.assertConnected(projectId);
    const safeSummary = safeText(summary, "symptom report");
    const safePaths = safeComponents(components);
    const safeUser = safeActor(actor);
    let relatedOutcome = null;
    if (relatedJobId !== null) {
      if (typeof relatedJobId !== "string" || !/^job_[A-Za-z0-9-]{1,100}$/.test(relatedJobId)) throw Object.assign(new Error("related_job_id_is_invalid"), { statusCode: 400 });
      relatedOutcome = (await this.projectService.listVerifiedOutcomes(id, { limit: MAX_VERIFIED_OUTCOMES })).find((item) => item.job_id === relatedJobId);
      if (!relatedOutcome) throw Object.assign(new Error("related_job_has_no_verified_project_evidence"), { statusCode: 400 });
    }
    const now = this.now().toISOString();
    const incident = {
      schema_version: 1,
      id: `incident_${globalThis.crypto.randomUUID()}`,
      project_id: id,
      source: "user_report",
      signature: null,
      symptom: { category: "user_reported", summary: safeSummary, failure_stage: null, check_names: [], failure_patterns: [], observed_at: now },
      cause_status: "unknown",
      hypotheses: [],
      confirmed_cause: null,
      components: safePaths,
      occurrence_count: 1,
      evidence_refs: relatedOutcome ? [{ job_id: relatedJobId, evidence_level: relatedOutcome.evidence_level, completed_at: relatedOutcome.completed_at }] : [],
      version: 1,
      created_at: now,
      updated_at: now,
      history: [{ version: 1, action: "user_symptom_reported", actor: safeUser, summary: safeSummary, evidence_job_ids: relatedOutcome ? [relatedJobId] : [], created_at: now }],
    };
    await seal(incident);
    await this.projectService.updateProjectData(id, async (data) => {
      const incidents = await this.validateCollection(data, id);
      return { ...data, incidents: [...incidents, incident].slice(-MAX_INCIDENTS_PER_PROJECT) };
    });
    return structuredClone(incident);
  }

  async addHypothesis(projectId, incidentId, { summary, components = [], evidenceJobIds = [], approach = "" } = {}, actor) {
    const id = await this.assertConnected(projectId);
    const cause = safeText(summary, "cause hypothesis");
    const strategy = approach ? safeText(approach, "approach", 800) : "";
    const paths = safeComponents(components);
    const safeUser = safeActor(actor);
    if (!Array.isArray(evidenceJobIds) || evidenceJobIds.length > 10 || evidenceJobIds.some((jobId) => typeof jobId !== "string" || !/^job_[A-Za-z0-9-]{1,100}$/.test(jobId))) throw new Error("hypothesis evidence is invalid");
    const outcomes = await this.projectService.listVerifiedOutcomes(id, { limit: MAX_VERIFIED_OUTCOMES });
    const evidence = evidenceJobIds.map((jobId) => {
      const item = outcomes.find((outcome) => outcome.job_id === jobId);
      if (!item) throw Object.assign(new Error("hypothesis evidence must reference verified outcomes in the same project"), { statusCode: 400 });
      return { job_id: jobId, completed_at: item.completed_at, outcome: item.outcome, check_names: item.required_checks.names };
    });
    const hypothesis = {
      id: `hypothesis_${globalThis.crypto.randomUUID()}`,
      summary: cause,
      approach: strategy,
      components: paths,
      status: "hypothesis",
      evidence_refs: evidence,
      created_by: safeUser,
      created_at: this.now().toISOString(),
    };
    let saved = null;
    await this.projectService.updateProjectData(id, async (data) => {
      const incidents = await this.validateCollection(data, id);
      const incident = incidents.find((item) => item.id === incidentId);
      if (!incident) throw Object.assign(new Error("incident_not_found"), { statusCode: 404 });
      if (incident.cause_status === "human_confirmed") throw Object.assign(new Error("incident cause is already confirmed"), { statusCode: 409 });
      if (incident.hypotheses.length >= MAX_HYPOTHESES_PER_INCIDENT) throw new Error("incident hypothesis limit reached");
      incident.hypotheses.push(hypothesis);
      incident.cause_status = "hypothesis";
      incident.components = [...new Set([...incident.components, ...paths])].slice(0, 20);
      addHistory(incident, { action: "cause_hypothesis_added", actor: safeUser, summary: cause, evidenceJobIds, now: this.now() });
      await seal(incident);
      saved = structuredClone(incident);
      return { ...data, incidents };
    });
    return saved;
  }

  async confirmCause(projectId, incidentId, { hypothesisId, failedJobId, correctedJobId, confirmation, sameChangeVerified = false, markApproachIneffective = false } = {}, actor) {
    const id = await this.assertConnected(projectId);
    const safeUser = safeActor(actor);
    if (confirmation !== `CONFIRM CAUSE ${incidentId}`) throw Object.assign(new Error(`type CONFIRM CAUSE ${incidentId} to confirm`), { statusCode: 400 });
    if (sameChangeVerified !== true) throw Object.assign(new Error("human confirmation must verify that the passing job covers the same corrective change"), { statusCode: 400 });
    if (typeof failedJobId !== "string" || typeof correctedJobId !== "string" || !/^job_[A-Za-z0-9-]{1,100}$/.test(failedJobId) || !/^job_[A-Za-z0-9-]{1,100}$/.test(correctedJobId)) throw Object.assign(new Error("cause evidence job IDs are invalid"), { statusCode: 400 });
    if (failedJobId === correctedJobId) throw new Error("failure and correction evidence must use different jobs");
    const outcomes = await this.projectService.listVerifiedOutcomes(id, { limit: MAX_VERIFIED_OUTCOMES });
    const failed = outcomes.find((item) => item.job_id === failedJobId);
    const corrected = outcomes.find((item) => item.job_id === correctedJobId);
    const matchingChecks = failed?.required_checks.names.filter((name) => corrected?.required_checks.names.includes(name)) ?? [];
    if (!failed || !corrected || failed.outcome !== "checks_failed" || corrected.outcome !== "success" || !matchingChecks.length || Date.parse(corrected.completed_at) <= Date.parse(failed.completed_at)) {
      throw Object.assign(new Error("cause confirmation requires a failed and later passing result for the same named check"), { statusCode: 409 });
    }
    let saved = null;
    await this.projectService.updateProjectData(id, async (data) => {
      const incidents = await this.validateCollection(data, id);
      const incident = incidents.find((item) => item.id === incidentId);
      if (!incident) throw Object.assign(new Error("incident_not_found"), { statusCode: 404 });
      const hypothesis = incident.hypotheses.find((item) => item.id === hypothesisId && item.status === "hypothesis");
      if (!hypothesis) throw Object.assign(new Error("cause_hypothesis_not_found"), { statusCode: 404 });
      if (!hypothesis.evidence_refs.some((item) => item.job_id === failedJobId && item.outcome === "checks_failed")) throw new Error("hypothesis must cite the verified failure being confirmed");
      if (incident.cause_status === "human_confirmed") throw new Error("incident cause is already confirmed");
      incident.cause_status = "human_confirmed";
      incident.confirmed_cause = {
        hypothesis_id: hypothesis.id,
        summary: hypothesis.summary,
        confirmed_by: safeUser,
        confirmed_at: this.now().toISOString(),
        same_change_verified: true,
        evidence_job_ids: [failedJobId, correctedJobId],
        regression_checks: matchingChecks,
        ineffective_approach: markApproachIneffective && hypothesis.approach ? hypothesis.approach : null,
      };
      hypothesis.status = "human_confirmed";
      hypothesis.confirmed_by = safeUser;
      hypothesis.confirmed_at = incident.confirmed_cause.confirmed_at;
      addHistory(incident, { action: "cause_human_confirmed", actor: safeUser, summary: hypothesis.summary, evidenceJobIds: [failedJobId, correctedJobId], now: this.now() });
      await seal(incident);
      saved = structuredClone(incident);
      return { ...data, incidents };
    });
    return saved;
  }

  async context(projectId, query = "") {
    const incidents = await this.list(projectId, { limit: 50 });
    const words = String(query).toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [];
    const score = (item) => {
      const text = [item.symptom?.summary, ...(item.symptom?.check_names ?? []), ...(item.symptom?.failure_patterns ?? []), ...item.components, ...item.hypotheses.map((hypothesis) => hypothesis.summary), item.confirmed_cause?.summary, item.confirmed_cause?.ineffective_approach].filter(Boolean).join(" ").toLowerCase();
      return words.reduce((count, word) => count + Number(text.includes(word)), 0);
    };
    return incidents.map((item) => ({ item, score: score(item) }))
      .filter(({ item, score: rank }) => item.cause_status === "human_confirmed" || rank > 0 || item.source === "runner_outcome")
      .sort((a, b) => Number(b.item.cause_status === "human_confirmed") - Number(a.item.cause_status === "human_confirmed") || b.score - a.score || b.item.updated_at.localeCompare(a.item.updated_at))
      .slice(0, 5)
      .map(({ item }) => ({
        source: item.source,
        symptom: structuredClone(item.symptom),
        components: item.components.slice(0, 20),
        cause_status: item.cause_status,
        hypotheses: item.cause_status !== "human_confirmed" ? item.hypotheses.slice(-3).map(({ summary, approach }) => ({ summary, approach, status: "hypothesis" })) : [],
        confirmed_cause: item.cause_status === "human_confirmed" ? structuredClone(item.confirmed_cause) : null,
        occurrence_count: item.occurrence_count,
        verified_evidence_available: item.verified_evidence_available === true,
      }));
  }

  async metrics(projectIds) {
    const incidents = [];
    for (const projectId of [...new Set(projectIds.map(projectKey))]) incidents.push(...await this.list(projectId, { limit: MAX_INCIDENTS_PER_PROJECT }));
    const now = this.now().getTime();
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const failureEvents = incidents.flatMap((incident) => incident.history
      .filter((event) => ["runner_failure_observed", "repeated_failure_observed"].includes(event.action))
      .map((event) => Date.parse(event.created_at)).filter(Number.isFinite));
    const failureObservationsLast7d = failureEvents.filter((time) => time > now - weekMs && time <= now).length;
    const failureObservationsPrevious7d = failureEvents.filter((time) => time > now - 2 * weekMs && time <= now - weekMs).length;
    return {
      observed_incidents: incidents.length,
      recurring_failures: incidents.filter((item) => item.source === "runner_outcome" && item.occurrence_count > 1).length,
      observed_failure_occurrences: incidents.filter((item) => item.source === "runner_outcome").reduce((sum, item) => sum + item.occurrence_count, 0),
      failure_observations_last_7d: failureObservationsLast7d,
      failure_observations_previous_7d: failureObservationsPrevious7d,
      failure_history_event_count: failureEvents.length,
      failure_history_may_be_truncated: incidents.some((item) => item.history.length >= MAX_INCIDENT_HISTORY),
      confirmed_causes: incidents.filter((item) => item.cause_status === "human_confirmed").length,
      confirmed_regressions: incidents.filter((item) => item.cause_status === "human_confirmed" && item.verified_evidence_available && item.confirmed_cause.regression_checks.length > 0).length,
      archived_confirmed_causes: incidents.filter((item) => item.cause_status === "human_confirmed" && !item.verified_evidence_available).length,
      open_hypotheses: incidents.reduce((sum, item) => sum + item.hypotheses.filter((hypothesis) => hypothesis.status === "hypothesis").length, 0),
      user_reports: incidents.filter((item) => item.source === "user_report").length,
      retention_limit_per_project: MAX_INCIDENTS_PER_PROJECT,
      history_limit_per_incident: MAX_INCIDENT_HISTORY,
    };
  }
}
