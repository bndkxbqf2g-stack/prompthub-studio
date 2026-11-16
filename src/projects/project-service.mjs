import { validateJobInput } from "../domain/job.mjs";
import { sha256Hex } from "../security/web-crypto.mjs";
import { normalizeTokenUsage } from "../metrics/token-usage.mjs";
import { FAILURE_PATTERN_NAMES } from "../knowledge/failure-classifier.mjs";

const PROJECT_ID_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const BLOCKING_STATUSES = new Set(["running", "stale"]);
const PAUSABLE_STATUSES = new Set(["queued", "awaiting_approval"]);
const MAX_VERIFIED_OUTCOMES = 200;
const MAX_STRATEGY_EVIDENCE_PAGES = 5;
const MAX_PROMPT_HANDOFFS_PER_PROJECT = 2;
const NONCRITICAL_STRATEGY_PATHS = [
  /^src\/pwa\/styles\.css$/i,
  /^src\/pwa\/assets\/[A-Za-z0-9._/-]+$/i,
];


function normalizeRepository(value) {
  if (typeof value !== "string" || !PROJECT_ID_PATTERN.test(value.trim())) {
    throw new Error("repository must use owner/name form");
  }
  return value.trim().toLowerCase();
}

function safeRepoSummary(repository) {
  return {
    id: repository.full_name.toLowerCase(),
    full_name: repository.full_name,
    url: repository.html_url,
    description: typeof repository.description === "string" ? repository.description.slice(0, 500) : "",
    private: repository.private === true,
    default_branch: repository.default_branch ?? "main",
    permissions: {
      pull: repository.permissions?.pull === true,
      push: repository.permissions?.push === true,
      admin: repository.permissions?.admin === true,
    },
  };
}

function parsePackageScripts(file) {
  if (!file) return {};
  try {
    const packageJson = JSON.parse(file.content);
    return Object.fromEntries(Object.entries(packageJson.scripts ?? {}).slice(0, 30));
  } catch {
    return { warning: "package.json could not be parsed" };
  }
}

function safeCiLabel(value) {
  const text = typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 160) : "";
  if (!text) return "unknown";
  try { validateJobInput({ prompt: text, project: "owner/ci", priority: 50 }); return text; }
  catch { return "[redacted]"; }
}

function validGitPath(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 500 && !value.startsWith("/") && !value.includes("\\") && !value.split("/").some((part) => part === "" || part === "." || part === "..");
}

async function collectGitHubPages(fetchPage) {
  const values = [];
  for (let page = 1; page <= MAX_STRATEGY_EVIDENCE_PAGES; page += 1) {
    const batch = await fetchPage(page);
    if (!Array.isArray(batch) || batch.length > 100) throw Object.assign(new Error("strategy evidence response is invalid"), { statusCode: 502 });
    values.push(...batch);
    if (batch.length < 100) return { values, complete: true };
  }
  return { values, complete: false };
}

function latestApprovedReviewers(reviews, pullRequestAuthor, headSha) {
  const latestByUser = new Map();
  for (const review of reviews) {
    const login = review?.user?.login;
    const submittedAt = Date.parse(review?.submitted_at ?? "");
    if (typeof login !== "string" || !login || review?.user?.type !== "User" || !Number.isFinite(submittedAt) || review.commit_id !== headSha) continue;
    const existing = latestByUser.get(login);
    if (!existing || submittedAt > existing.submittedAt) latestByUser.set(login, { login, submittedAt, state: review.state });
    else if (submittedAt === existing.submittedAt && existing.state !== review.state) existing.state = "AMBIGUOUS";
  }
  return [...latestByUser.values()]
    .filter((review) => review.login.toLowerCase() !== pullRequestAuthor.toLowerCase() && review.state === "APPROVED")
    .map(({ login, submittedAt }) => ({ login, reviewed_at: new Date(submittedAt).toISOString() }))
    .sort((a, b) => a.login.localeCompare(b.login));
}

export class ProjectService {
  constructor({ store, client, controlPlane, controlRepository = "", now = () => new Date() } = {}) {
    if (!store || !client || !controlPlane) throw new Error("store, GitHub client and control plane are required");
    this.store = store;
    this.client = client;
    this.controlPlane = controlPlane;
    this.controlRepository = controlRepository.toLowerCase();
    this.now = now;
  }

  async list() {
    return (await this.store.list()).sort((a, b) => a.id.localeCompare(b.id));
  }

  async get(id) {
    return this.store.get(normalizeRepository(id));
  }

  async analyze(repository) {
    const [readme, agents, packageJson, workflows, issues, runs] = await Promise.all([
      this.client.getContent(repository.id, "README.md", repository.default_branch),
      this.client.getContent(repository.id, "AGENTS.md", repository.default_branch),
      this.client.getContent(repository.id, "package.json", repository.default_branch),
      this.client.listContents(repository.id, ".github/workflows", repository.default_branch).catch((error) => error?.status === 404 ? [] : Promise.reject(error)),
      this.client.listIssues(repository.id, { state: "open", perPage: 100 }).catch((error) => error?.status === 404 ? [] : Promise.reject(error)),
      this.client.listWorkflowRuns(repository.id, 5).catch((error) => error?.status === 404 ? { workflow_runs: [] } : Promise.reject(error)),
    ]);
    const sourceRefs = {
      "README.md": readme?.sha ?? null,
      "AGENTS.md": agents?.sha ?? null,
      "package.json": packageJson?.sha ?? null,
    };
    const runRecords = (runs?.workflow_runs ?? []).slice(0, 5);
    const inspectableFailures = runRecords.filter((run) => run.conclusion === "failure" && Number.isSafeInteger(run.id) && run.id > 0).slice(0, 2);
    const inspectedJobs = typeof this.client.listWorkflowRunJobs === "function"
      ? await Promise.all(inspectableFailures.map(async (run) => {
          try { return [run.id, await this.client.listWorkflowRunJobs(repository.id, run.id, 100)]; }
          catch { return [run.id, null]; }
        }))
      : [];
    const jobsByRun = new Map(inspectedJobs);
    const recentCi = runRecords.map((run) => {
      const response = jobsByRun.get(run.id);
      const failedJobs = (response?.jobs ?? []).filter((item) => item.conclusion === "failure").slice(0, 10).map((item) => ({
        name: safeCiLabel(item.name),
        failed_steps: (item.steps ?? []).filter((step) => step.conclusion === "failure").slice(0, 10).map((step) => safeCiLabel(step.name)),
      }));
      return {
        name: safeCiLabel(run.name),
        status: safeCiLabel(run.status),
        conclusion: safeCiLabel(run.conclusion),
        updated_at: run.updated_at,
        html_url: typeof run.html_url === "string" ? run.html_url : null,
        failed_jobs: failedJobs,
        failure_detail_status: run.conclusion !== "failure" ? "not_applicable" : response ? "inspected" : "unavailable",
      };
    });
    const snapshotFacts = {
      source_refs: sourceRefs,
      workflows: Array.isArray(workflows) ? workflows.filter((item) => item.type === "file").map((item) => item.name).sort() : [],
      open_issues: Array.isArray(issues) ? issues.filter((item) => !item.pull_request).map((item) => ({ number: item.number, title: item.title, updated_at: item.updated_at })) : [],
      recent_ci: recentCi.map(({ name, status, conclusion, updated_at, failed_jobs, failure_detail_status }) => ({ name, status, conclusion, updated_at, failed_jobs, failure_detail_status })),
    };
    const snapshotVersion = await sha256Hex(JSON.stringify(snapshotFacts));
    return {
      analyzed_at: this.now().toISOString(),
      source: "github_read_only_api",
      summary_schema_version: 1,
      snapshot_version: snapshotVersion,
      source_refs: sourceRefs,
      project_rules: agents?.content?.slice(0, 20000) ?? null,
      readme_summary: readme?.content?.slice(0, 12000) ?? null,
      scripts: parsePackageScripts(packageJson),
      workflows: Array.isArray(workflows) ? workflows.filter((item) => item.type === "file").map((item) => item.name).slice(0, 50) : [],
      open_issues: Array.isArray(issues) ? issues.filter((item) => !item.pull_request).slice(0, 30).map((item) => ({ number: item.number, title: String(item.title ?? "").slice(0, 300), updated_at: item.updated_at, labels: (item.labels ?? []).map((label) => typeof label === "string" ? label : label.name).slice(0, 10) })) : [],
      recent_ci: recentCi,
    };
  }

  async connect(input, actor = "user") {
    const requested = normalizeRepository(input);
    if (requested === this.controlRepository) throw new Error("the PromptHub control repository cannot be added as a managed project");
    const metadata = await this.client.getRepository(requested);
    if (!metadata?.full_name || metadata.permissions?.pull === false) throw new Error("repository must be readable by the configured GitHub identity");
    const repository = safeRepoSummary(metadata);
    repository.analysis = await this.analyze(repository);
    return this.updateProject(repository.id, (existing) => {
      const now = this.now().toISOString();
      return {
        ...(existing ?? {}),
        ...repository,
        status: "connected",
        connected_at: existing?.connected_at ?? now,
        reconnected_at: existing?.status === "removed" ? now : (existing?.reconnected_at ?? null),
        removed_at: null,
        last_actor: actor,
      };
    });
  }

  async remove(input, { confirmation, actor = "user" } = {}) {
    const id = normalizeRepository(input);
    if (confirmation !== `REMOVE ${id}`) throw Object.assign(new Error(`type REMOVE ${id} to confirm`), { statusCode: 400 });
    let handoffBlockers = [];
    await this.updateProject(id, (project) => {
      handoffBlockers = [];
      if (!project || project.status !== "connected") throw Object.assign(new Error("project is not connected"), { statusCode: 409 });
      if (project.prompt_handoff_claims !== undefined && !Array.isArray(project.prompt_handoff_claims)) {
        throw Object.assign(new Error("project_handoff_state_is_invalid"), { statusCode: 409 });
      }
      handoffBlockers = (project.prompt_handoff_claims ?? []).map((claim) => ({
        job_id: claim.job_id,
        status: claim.status === "pending" ? "handoff_pending" : claim.status === "unknown" ? "handoff_unknown" : "handoff_state_invalid",
      }));
      if (handoffBlockers.length) return project;
      return { ...project, status: "removing", removal_started_at: this.now().toISOString(), last_actor: actor };
    });
    if (handoffBlockers.length) return { removed: false, blocked_by: handoffBlockers };

    const projectData = await this.store.getProjectData(id);
    const jobs = (await this.controlPlane.listJobs()).filter((job) => job.project.toLowerCase() === id);
    const jobIds = new Set(jobs.map((job) => job.id));
    const unresolvedHandoffs = (projectData.drafts ?? []).filter((draft) =>
      ["handoff_pending", "handoff_unknown", "submitted"].includes(draft.stage) && draft.job_id && !jobIds.has(draft.job_id));
    if (unresolvedHandoffs.length) {
      await this.updateProject(id, (current) => current?.status === "removing"
        ? { ...current, status: "connected", removal_started_at: null, last_actor: actor }
        : current);
      return {
        removed: false,
        blocked_by: unresolvedHandoffs.map((draft) => ({
          job_id: draft.job_id,
          status: draft.stage === "submitted" ? "handoff_submitted" : draft.stage,
        })),
      };
    }

    const blocking = jobs.filter((job) => BLOCKING_STATUSES.has(job.status));
    for (const job of jobs.filter((item) => PAUSABLE_STATUSES.has(item.status))) {
      await this.controlPlane.pauseJob(job.id, actor, "Project unlink requested");
    }
    if (blocking.length) {
      await this.updateProject(id, (current) => current?.status === "removing"
        ? { ...current, status: "connected", removal_started_at: null, last_actor: actor }
        : current);
      return { removed: false, blocked_by: blocking.map(({ id: jobId, status }) => ({ job_id: jobId, status })) };
    }
    const next = await this.updateProject(id, (current) => {
      if (!current || current.status !== "removing" || (current.prompt_handoff_claims ?? []).length) {
        throw Object.assign(new Error("project_removal_state_changed"), { statusCode: 409 });
      }
      return { ...current, status: "removed", removed_at: this.now().toISOString(), removal_started_at: null, last_actor: actor };
    });
    return { removed: true, project: next, paused_jobs: jobs.filter((job) => PAUSABLE_STATUSES.has(job.status)).map((job) => job.id) };
  }

  async claimPromptHandoff(input, { draftId, jobId, actor, leaseExpiresAt } = {}) {
    const id = normalizeRepository(input);
    if (typeof draftId !== "string" || !/^draft_[0-9a-f-]{36}$/i.test(draftId) || jobId !== `job_${draftId}`
      || typeof actor !== "string" || actor.trim().length === 0 || actor.length > 100
      || !Number.isFinite(Date.parse(leaseExpiresAt ?? ""))) {
      throw Object.assign(new Error("prompt_handoff_claim_is_invalid"), { statusCode: 400 });
    }
    const claimedAt = this.now().toISOString();
    let created = false;
    const project = await this.updateProject(id, (current) => {
      created = false;
      if (!current || current.status !== "connected") throw Object.assign(new Error("project_not_connected_for_prompt_handoff"), { statusCode: 409 });
      const claims = Array.isArray(current.prompt_handoff_claims) ? current.prompt_handoff_claims : [];
      if (current.prompt_handoff_claims !== undefined && !Array.isArray(current.prompt_handoff_claims)) throw Object.assign(new Error("project_handoff_state_is_invalid"), { statusCode: 409 });
      const existing = claims.find((claim) => claim.job_id === jobId);
      if (existing) {
        if (existing.draft_id !== draftId || existing.actor !== actor) throw Object.assign(new Error("prompt_handoff_claim_conflict"), { statusCode: 409 });
        return current;
      }
      if (claims.length >= MAX_PROMPT_HANDOFFS_PER_PROJECT) throw Object.assign(new Error("project_prompt_handoff_capacity_reached"), { statusCode: 409 });
      created = true;
      return {
        ...current,
        prompt_handoff_claims: [...claims, { draft_id: draftId, job_id: jobId, actor, status: "pending", claimed_at: claimedAt, lease_expires_at: new Date(Date.parse(leaseExpiresAt)).toISOString() }],
      };
    });
    return { project, created };
  }

  async completePromptHandoff(input, jobId, { unknown = false } = {}) {
    const id = normalizeRepository(input);
    return this.updateProject(id, (project) => {
      if (!project) throw Object.assign(new Error("project_not_found"), { statusCode: 404 });
      const claims = Array.isArray(project.prompt_handoff_claims) ? project.prompt_handoff_claims : [];
      if (project.prompt_handoff_claims !== undefined && !Array.isArray(project.prompt_handoff_claims)) throw Object.assign(new Error("project_handoff_state_is_invalid"), { statusCode: 409 });
      const matching = claims.find((claim) => claim.job_id === jobId);
      if (!matching) return project;
      if (unknown) {
        return {
          ...project,
          prompt_handoff_claims: claims.map((claim) => claim.job_id === jobId ? { ...claim, status: "unknown", lease_expires_at: null, updated_at: this.now().toISOString() } : claim),
        };
      }
      return { ...project, prompt_handoff_claims: claims.filter((claim) => claim.job_id !== jobId) };
    });
  }

  async deleteProjectData(input, { confirmation, actor = "user" } = {}) {
    const id = normalizeRepository(input);
    if (confirmation !== `DELETE DATA ${id}`) throw Object.assign(new Error(`type DELETE DATA ${id} to confirm`), { statusCode: 400 });
    const project = await this.store.get(id);
    if (!project || project.status !== "removed") throw new Error("remove the project from PromptHub before deleting its saved data");
    const active = (await this.controlPlane.listJobs()).filter((job) => job.project.toLowerCase() === id && BLOCKING_STATUSES.has(job.status));
    if (active.length) throw Object.assign(new Error("running or unclear jobs block project data deletion"), { statusCode: 409 });
    await this.store.deleteProjectData(id);
    const updated = await this.updateProject(project.id, (current) => {
      if (!current || current.status !== "removed") throw Object.assign(new Error("project_state_changed_during_data_deletion"), { statusCode: 409 });
      return { ...current, saved_data_deleted_at: this.now().toISOString(), last_actor: actor };
    });
    return { deleted: true, project: updated, historical_versions_may_remain: true };
  }

  async updateProject(id, updater) {
    const projectId = normalizeRepository(id);
    if (typeof this.store.updateProject !== "function") throw new Error("project store does not support atomic project updates");
    return this.store.updateProject(projectId, updater);
  }

  async getProjectData(id) {
    const project = await this.store.get(normalizeRepository(id));
    if (!project) throw new Error("project is not known");
    return this.store.getProjectData(project.id);
  }

  async saveProjectData(id, value) {
    const project = await this.store.get(normalizeRepository(id));
    if (!project) throw new Error("project is not known");
    return this.store.saveProjectData(project.id, value);
  }

  async updateProjectData(id, updater) {
    const project = await this.store.get(normalizeRepository(id));
    if (!project) throw new Error("project is not known");
    if (typeof this.store.updateProjectData !== "function") throw new Error("project store does not support atomic project-data updates");
    return this.store.updateProjectData(project.id, updater);
  }

  async verifyStrategyEvidence(input, { pullRequestNumber, workflowRunId, checkName = "test" } = {}) {
    const id = normalizeRepository(input);
    if (!Number.isSafeInteger(pullRequestNumber) || pullRequestNumber < 1 || !Number.isSafeInteger(workflowRunId) || workflowRunId < 1 || checkName !== "test") {
      throw Object.assign(new Error("strategy evidence reference is invalid"), { statusCode: 400 });
    }
    const project = await this.store.get(id);
    if (!project || project.status !== "connected") throw Object.assign(new Error("project is not connected"), { statusCode: 409 });
    for (const method of ["getPullRequest", "getWorkflowRun", "listWorkflowRunJobs", "listPullRequestFiles", "listPullRequestReviews"]) {
      if (typeof this.client[method] !== "function") throw Object.assign(new Error("verified GitHub strategy evidence is unavailable"), { statusCode: 503 });
    }

    const [pullRequest, run] = await Promise.all([
      this.client.getPullRequest(id, pullRequestNumber),
      this.client.getWorkflowRun(id, workflowRunId),
    ]);
    const headSha = pullRequest?.head?.sha;
    const author = pullRequest?.user?.login;
    const baseRepository = pullRequest?.base?.repo?.full_name?.toLowerCase();
    const headRepository = pullRequest?.head?.repo?.full_name?.toLowerCase();
    if (pullRequest?.number !== pullRequestNumber || pullRequest?.state !== "closed" || pullRequest?.merged !== true || !Number.isFinite(Date.parse(pullRequest.merged_at ?? "")) || baseRepository !== id || headRepository !== id || typeof author !== "string" || !author || !/^[a-f0-9]{40}$/i.test(headSha ?? "")) {
      throw Object.assign(new Error("strategy evidence requires a merged same-repository pull request"), { statusCode: 409 });
    }
    const runPullRequest = (run?.pull_requests ?? []).some((item) => item?.number === pullRequestNumber && item?.head?.sha === headSha);
    if (run?.id !== workflowRunId || run?.status !== "completed" || run?.conclusion !== "success" || run?.head_sha !== headSha || !runPullRequest || !Number.isFinite(Date.parse(run.completed_at ?? "")) || run?.repository?.full_name?.toLowerCase() !== id) {
      throw Object.assign(new Error("strategy evidence does not match a completed passing workflow run for this pull request head"), { statusCode: 409 });
    }

    const jobs = await collectGitHubPages((page) => this.client.listWorkflowRunJobs(id, workflowRunId, 100, page).then((response) => response?.jobs));
    if (!jobs.complete) throw Object.assign(new Error("strategy evidence job listing is incomplete"), { statusCode: 409 });
    const check = jobs.values.find((item) => item?.name === checkName);
    if (!check || check.conclusion !== "success" || !Number.isFinite(Date.parse(check.completed_at ?? ""))) {
      throw Object.assign(new Error("strategy evidence is missing a passing required test job"), { statusCode: 409 });
    }

    const files = await collectGitHubPages((page) => this.client.listPullRequestFiles(id, pullRequestNumber, { perPage: 100, page }));
    const paths = [];
    let malformedPaths = false;
    for (const file of files.values) {
      if (!validGitPath(file?.filename)) malformedPaths = true;
      else paths.push(file.filename);
      if (file?.previous_filename !== undefined) {
        if (!validGitPath(file.previous_filename)) malformedPaths = true;
        else paths.push(file.previous_filename);
      }
    }
    const uniquePaths = [...new Set(paths)].sort();
    const critical = !files.complete || malformedPaths || uniquePaths.length === 0 || uniquePaths.some((path) => !NONCRITICAL_STRATEGY_PATHS.some((pattern) => pattern.test(path)));
    let independentReviewers = [];
    let reviewsComplete = true;
    if (critical) {
      const reviews = await collectGitHubPages((page) => this.client.listPullRequestReviews(id, pullRequestNumber, { perPage: 100, page }));
      independentReviewers = latestApprovedReviewers(reviews.values, author, headSha);
      reviewsComplete = reviews.complete;
    }
    return {
      schema_version: 1,
      project_id: id,
      pull_request_number: pullRequestNumber,
      pull_request_author: author,
      head_sha: headSha.toLowerCase(),
      workflow_run_id: workflowRunId,
      check_name: checkName,
      check_completed_at: new Date(Date.parse(check.completed_at)).toISOString(),
      run_completed_at: new Date(Date.parse(run.completed_at)).toISOString(),
      merged_at: new Date(Date.parse(pullRequest.merged_at)).toISOString(),
      changed_file_count: uniquePaths.length,
      changed_files_digest: await sha256Hex(JSON.stringify(uniquePaths)),
      file_list_complete: files.complete,
      file_list_valid: !malformedPaths,
      critical,
      independent_reviewers: independentReviewers,
      review_list_complete: reviewsComplete,
      verified: true,
      source: "github_pull_request_and_actions_api",
    };
  }

  async recordVerifiedJobOutcome(jobId) {
    const job = await this.controlPlane.getJob(jobId);
    if (!job) throw Object.assign(new Error("job_not_found"), { statusCode: 404 });
    if (!/^job_[A-Za-z0-9-]{1,100}$/.test(job.id ?? "") || job.id !== jobId) throw Object.assign(new Error("job_identity_is_invalid"), { statusCode: 409 });
    if (!["succeeded", "failed"].includes(job.status)) throw Object.assign(new Error("job_not_terminal"), { statusCode: 409 });
    const completion = [...(job.events ?? [])].reverse().find((event) => event.type === "completed" && event.status === job.status && event.source === "prompthub");
    const checks = completion?.required_checks ?? job.required_checks;
    if (!completion || typeof completion.event_id !== "string" || !Number.isFinite(Date.parse(completion.created_at)) || !checks || typeof checks.passed !== "boolean" || !Array.isArray(checks.names)) {
      throw Object.assign(new Error("verified_completion_evidence_missing"), { statusCode: 409 });
    }
    if (job.status === "succeeded" && (!checks.passed || checks.names.length === 0)) {
      throw Object.assign(new Error("successful_job_lacks_passing_check_evidence"), { statusCode: 409 });
    }
    if (job.status === "failed" && checks.passed) {
      throw Object.assign(new Error("job_status_conflicts_with_check_evidence"), { statusCode: 409 });
    }

    const projectId = normalizeRepository(job.project);
    const project = await this.store.get(projectId);
    if (!project || project.status !== "connected") throw Object.assign(new Error("project_not_connected_for_learning"), { statusCode: 409 });
    const checkNames = checks.names.slice(0, 30).map((name) => {
      if (typeof name !== "string" || !name.trim()) throw new Error("check evidence is invalid");
      const normalized = name.trim().slice(0, 160);
      validateJobInput({ prompt: normalized, project: "owner/check", priority: 50 });
      return normalized;
    });
    const failurePatterns = checks.failure_patterns ?? [];
    if (!Array.isArray(failurePatterns) || failurePatterns.length > 8 || failurePatterns.some((name) => !FAILURE_PATTERN_NAMES.includes(name)) || (job.status === "succeeded" && failurePatterns.length > 0)) throw new Error("failure diagnostic patterns are invalid");
    const lastCheckpoint = [...(job.events ?? [])].reverse().find((event) => event.type === "checkpoint" && event.source === "prompthub");
    const failureStage = job.status === "failed" && ["checks", "execute", "runner"].includes(lastCheckpoint?.phase) ? lastCheckpoint.phase : null;
    const metrics = job.resource_metrics ?? completion.resource_metrics ?? {};
    const resourceMetrics = {};
    for (const field of ["runtime_ms", "retries", "executor_invocations", "model_calls"]) {
      if (Number.isSafeInteger(metrics[field]) && metrics[field] >= 0) resourceMetrics[field] = metrics[field];
    }
    const tokenSource = ["execution_provider", "verified_free_provider"].includes(metrics.token_usage?.source) ? metrics.token_usage.source : "unknown_provider";
    const tokenUsage = normalizeTokenUsage(metrics.token_usage, tokenSource);
    if (tokenUsage) resourceMetrics.token_usage = tokenUsage;

    const evidence = {
      schema_version: 1,
      id: `outcome_${job.id}`,
      project_id: projectId,
      job_id: job.id,
      job_status: job.status,
      outcome: job.status === "succeeded" ? "success" : checkNames.length ? "checks_failed" : "execution_failed_before_checks",
      evidence_level: job.status === "succeeded" ? "required_checks_passed" : checkNames.length ? "required_checks_failed" : "executor_or_runner_failure",
      failure_stage: failureStage,
      verified: true,
      source: "control_plane_completion_event",
      completion_event_id: completion.event_id,
      issue_number: Number.isSafeInteger(job.issue_number) ? job.issue_number : null,
      completed_at: completion.created_at,
      required_checks: { passed: checks.passed, names: checkNames },
      failure_patterns: [...new Set(failurePatterns)],
      resource_metrics: resourceMetrics,
    };
    const evidenceDigest = await sha256Hex(JSON.stringify(evidence));
    const record = { ...evidence, evidence_digest: evidenceDigest };
    let created = false;
    const updated = await this.updateProjectData(projectId, (data) => {
      if (data.verified_outcomes !== undefined && (!Array.isArray(data.verified_outcomes) || data.verified_outcomes.length > MAX_VERIFIED_OUTCOMES)) {
        throw new Error("project outcome history is invalid; refusing to overwrite it");
      }
      const outcomes = data.verified_outcomes ?? [];
      const existing = outcomes.find((item) => item.job_id === job.id);
      if (existing) {
        if (existing.evidence_digest !== evidenceDigest) throw new Error("stored outcome evidence conflicts with the control-plane record");
        created = false;
        return data;
      }
      created = true;
      return { ...data, verified_outcomes: [...outcomes, record].slice(-MAX_VERIFIED_OUTCOMES) };
    });
    const saved = updated.verified_outcomes?.find((item) => item.job_id === job.id);
    if (!saved) throw new Error("verified outcome was not persisted");
    return { outcome: structuredClone(saved), created };
  }

  async listVerifiedOutcomes(input, { limit = 10 } = {}) {
    const id = normalizeRepository(input);
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_VERIFIED_OUTCOMES) throw new Error(`outcome limit must be between 1 and ${MAX_VERIFIED_OUTCOMES}`);
    const project = await this.store.get(id);
    if (!project || project.status !== "connected") throw new Error("project is not connected");
    const data = await this.getProjectData(id);
    if (data.verified_outcomes === undefined) return [];
    if (!Array.isArray(data.verified_outcomes) || data.verified_outcomes.length > MAX_VERIFIED_OUTCOMES) {
      throw new Error("project outcome history is invalid; refusing to use it");
    }
    const verified = [];
    for (const item of data.verified_outcomes) {
      if (!item || item.schema_version !== 1 || item.project_id !== id || item.verified !== true || item.source !== "control_plane_completion_event") {
        throw new Error("project outcome evidence is invalid; refusing to use it");
      }
      if (typeof item.job_id !== "string" || !/^job_[A-Za-z0-9-]{1,100}$/.test(item.job_id) || item.id !== `outcome_${item.job_id}` || !["succeeded", "failed"].includes(item.job_status) || typeof item.completion_event_id !== "string" || !/^evt_[A-Za-z0-9-]{1,100}$/.test(item.completion_event_id) || !Number.isFinite(Date.parse(item.completed_at)) || (item.issue_number !== null && (!Number.isSafeInteger(item.issue_number) || item.issue_number < 1)) || (item.failure_stage !== null && !["checks", "execute", "runner"].includes(item.failure_stage))) {
        throw new Error("project outcome evidence is invalid; refusing to use it");
      }
      if (!item.required_checks || typeof item.required_checks.passed !== "boolean" || !Array.isArray(item.required_checks.names) || item.required_checks.names.length > 30) {
        throw new Error("project outcome checks are invalid; refusing to use them");
      }
      const failurePatterns = item.failure_patterns ?? [];
      if (!Array.isArray(failurePatterns) || failurePatterns.length > 8 || failurePatterns.some((name) => !FAILURE_PATTERN_NAMES.includes(name)) || (item.job_status === "succeeded" && failurePatterns.length > 0)) throw new Error("project outcome failure diagnostics are invalid; refusing to use them");
      const names = item.required_checks.names.map((name) => {
        if (typeof name !== "string" || !name.trim() || name.length > 160) throw new Error("project outcome checks are invalid; refusing to use them");
        validateJobInput({ prompt: name, project: "owner/check", priority: 50 });
        return name;
      });
      const consistentSuccess = item.job_status === "succeeded" && item.outcome === "success" && item.evidence_level === "required_checks_passed" && item.required_checks.passed && names.length > 0;
      const consistentCheckFailure = item.job_status === "failed" && item.outcome === "checks_failed" && item.evidence_level === "required_checks_failed" && !item.required_checks.passed && names.length > 0;
      const consistentExecutionFailure = item.job_status === "failed" && item.outcome === "execution_failed_before_checks" && item.evidence_level === "executor_or_runner_failure" && !item.required_checks.passed && names.length === 0;
      if (!consistentSuccess && !consistentCheckFailure && !consistentExecutionFailure) throw new Error("project outcome classification is inconsistent; refusing to use it");
      const metrics = {};
      if (!item.resource_metrics || typeof item.resource_metrics !== "object" || Array.isArray(item.resource_metrics)) throw new Error("project outcome metrics are invalid; refusing to use them");
      for (const field of ["runtime_ms", "retries", "executor_invocations", "model_calls"]) {
        if (item.resource_metrics[field] !== undefined) {
          if (!Number.isSafeInteger(item.resource_metrics[field]) || item.resource_metrics[field] < 0) throw new Error("project outcome metrics are invalid; refusing to use them");
          metrics[field] = item.resource_metrics[field];
        }
      }
      const rawTokens = item.resource_metrics.token_usage;
      const tokenSource = ["execution_provider", "verified_free_provider", "unknown_provider"].includes(rawTokens?.source) ? rawTokens.source : "unknown_provider";
      const tokenUsage = normalizeTokenUsage(rawTokens, tokenSource);
      if (tokenUsage) metrics.token_usage = tokenUsage;
      const expected = {
        schema_version: item.schema_version,
        id: item.id,
        project_id: item.project_id,
        job_id: item.job_id,
        job_status: item.job_status,
        outcome: item.outcome,
        evidence_level: item.evidence_level,
        failure_stage: item.failure_stage,
        verified: item.verified,
        source: item.source,
        completion_event_id: item.completion_event_id,
        issue_number: item.issue_number,
        completed_at: item.completed_at,
        required_checks: { passed: item.required_checks.passed, names },
        ...(item.failure_patterns !== undefined ? { failure_patterns: [...new Set(failurePatterns)] } : {}),
        resource_metrics: metrics,
      };
      if (!/^[a-f0-9]{64}$/.test(item.evidence_digest ?? "") || await sha256Hex(JSON.stringify(expected)) !== item.evidence_digest) {
        throw new Error("project outcome digest does not match; refusing to use it");
      }
      verified.push({
        id: item.id,
        job_id: item.job_id,
        project_id: item.project_id,
        job_status: item.job_status,
        outcome: item.outcome,
        evidence_level: item.evidence_level,
        failure_stage: item.failure_stage,
        completed_at: item.completed_at,
        completion_event_id: item.completion_event_id,
        evidence_digest: item.evidence_digest,
        required_checks: { passed: item.required_checks.passed, names },
        failure_patterns: [...new Set(failurePatterns)],
        resource_metrics: metrics,
        verified: true,
        source: "control_plane_completion_event",
      });
    }
    return verified.slice(-limit).reverse();
  }

  async getLibraryReviews() {
    return this.store.getGlobalData("prompt-library-reviews");
  }

  async saveLibraryReview(entryId, payload, actor = "user") {
    if (!/^[a-z0-9][a-z0-9-]{1,100}$/.test(entryId)) throw new Error("invalid prompt library entry id");
    if (payload.favorite !== undefined && typeof payload.favorite !== "boolean") throw new Error("favorite must be a boolean");
    for (const field of ["note", "correction"]) {
      if (payload[field] !== undefined && typeof payload[field] !== "string") throw new Error(`${field} must be text`);
      if ((payload[field] ?? "").length > 1500) throw new Error(`${field} exceeds the maximum length`);
      if (payload[field]?.trim()) validateJobInput({ prompt: payload[field], project: "owner/library", priority: 50 });
    }
    const collection = await this.getLibraryReviews();
    const existing = collection.entries.find((item) => item.entry_id === entryId);
    const version = {
      version: (existing?.version ?? 0) + 1,
      updated_at: this.now().toISOString(),
      updated_by: actor,
      ...(payload.favorite === undefined ? {} : { favorite: payload.favorite }),
      ...(payload.note === undefined ? {} : { note: payload.note.trim() }),
      ...(payload.correction === undefined ? {} : { correction: payload.correction.trim() }),
    };
    const next = { entry_id: entryId, version: version.version, history: [...(existing?.history ?? []), version].slice(-20), ...version };
    collection.entries = [...collection.entries.filter((item) => item.entry_id !== entryId), next].slice(-1000);
    await this.store.saveGlobalData("prompt-library-reviews", collection);
    return next;
  }
}

export { normalizeRepository };
