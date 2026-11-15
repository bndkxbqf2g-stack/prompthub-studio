import { parseCookies, safeLocalRedirectPath } from "../auth/github-oauth.mjs";
import { STATUS_LABELS, publicJob, validateJobInput } from "../domain/job.mjs";
import { summarizeResourceMetrics } from "../metrics/resource-metrics.mjs";

const SECURITY_HEADERS = Object.freeze({
  "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; manifest-src 'self'; worker-src 'self'",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
});

function json(status, value, headers = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...SECURITY_HEADERS, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers },
  });
}

function redirect(location, headers = {}) {
  return new Response(null, { status: 302, headers: { ...SECURITY_HEADERS, Location: location, "Cache-Control": "no-store", ...headers } });
}

async function bodyJson(request, maxBytes = 100_000) {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > maxBytes) throw Object.assign(new Error("request body too large"), { statusCode: 413 });
  if (!request.body) return {};
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw Object.assign(new Error("request body too large"), { statusCode: 413 });
    }
    chunks.push(value);
  }
  if (chunks.length === 0) return {};
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw Object.assign(new Error("request body must be valid JSON"), { statusCode: 400 });
  }
}

function safeError(error) {
  if (error?.statusCode) return { status: error.statusCode, message: error.message };
  if (error?.name === "GitHubApiError") return { status: 502, message: "GitHub control plane is unavailable" };
  if (/required|must be|invalid|not in the configured|not awaiting|decision must|appears to contain a secret/i.test(error?.message ?? "")) return { status: 400, message: error.message };
  return { status: 500, message: "Unexpected internal error" };
}

function jobIdFromPath(pathname) {
  const match = /^\/api\/jobs\/([^/]+)(?:\/approve)?$/.exec(pathname);
  return match ? decodeURIComponent(match[1]) : null;
}

async function handleDesigner({ request, url, pathname, promptDesigner, actor }) {
  if (request.method === "POST" && pathname === "/api/designer/drafts") {
    return json(201, { draft: await promptDesigner.create(await bodyJson(request, 40_000)) });
  }
  if (request.method === "GET" && pathname === "/api/designer/drafts") {
    const project = url.searchParams.get("project");
    if (!project) return json(400, { error: "project_required" });
    return json(200, { drafts: await promptDesigner.list(project) });
  }
  const match = /^\/api\/designer\/drafts\/([^/]+)(?:\/(start|answer|skip|finish|generate|approve|export))?$/.exec(pathname);
  if (!match) return null;
  const draftId = decodeURIComponent(match[1]);
  const action = match[2] ?? "get";
  if (request.method === "GET" && action === "get") {
    const project = url.searchParams.get("project");
    if (!project) return json(400, { error: "project_required" });
    const draft = await promptDesigner.get(project, draftId);
    return draft ? json(200, { draft }) : json(404, { error: "draft_not_found" });
  }
  if (request.method !== "POST" && !(request.method === "GET" && action === "export")) return json(405, { error: "method_not_allowed" });
  const payload = request.method === "GET" ? {} : await bodyJson(request, 40_000);
  const project = payload.project ?? url.searchParams.get("project");
  if (!project) return json(400, { error: "project_required" });
  if (action === "start") return json(200, { draft: await promptDesigner.start(project, draftId) });
  if (action === "answer") return json(200, { draft: await promptDesigner.answer(project, draftId, payload) });
  if (action === "skip") return json(200, { draft: await promptDesigner.skip(project, draftId) });
  if (action === "finish") return json(200, { draft: await promptDesigner.finishInterview(project, draftId) });
  if (action === "generate") return json(200, { draft: await promptDesigner.generate(project, draftId) });
  if (action === "approve") return json(200, { job: await promptDesigner.approve(project, draftId, { ...payload, actor }) });
  if (action === "export") return json(200, { files: await promptDesigner.markdownFiles(project, draftId) });
  return json(404, { error: "not_found" });
}

export function createRequestHandler({ config, controlPlane, auth, projectService = null, promptDesigner = null, promptLibrary = null, errorLearning = null, strategyLearning = null, logger = console, enforceSameOrigin = false, beforeProtectedApi = null } = {}) {
  if (!config || !controlPlane || !auth) throw new Error("config, controlPlane and auth are required");
  let metricCache = null;
  let metricPending = null;
  async function loadMetricSnapshot() {
    const now = Date.now();
    if (metricCache && metricCache.expires_at > now) return { ...metricCache.value, cache_source: "short_cache" };
    if (metricPending) return { ...await metricPending, cache_source: "coalesced" };
    const pending = (async () => {
      const jobs = await controlPlane.listJobs();
      const drafts = [];
      let connectedProjects = 0;
      const connectedProjectIds = [];
      let ciFailureRuns = 0;
      if (projectService && promptDesigner) {
        for (const project of await projectService.list()) {
          if (project.status === "connected") {
            drafts.push(...await promptDesigner.list(project.id));
            connectedProjects += 1;
            connectedProjectIds.push(project.id);
            ciFailureRuns += (project.analysis?.recent_ci ?? []).filter((run) => run.conclusion === "failure").length;
          }
        }
      }
      const errorMetrics = errorLearning ? await errorLearning.metrics(connectedProjectIds) : null;
      return {
        metrics: { ...summarizeResourceMetrics({ jobs, drafts }), errors: errorMetrics ? { ...errorMetrics, source: "verified_project_incident_history" } : { status: "not_available" }, ci_diagnostic: { failed_runs_in_recent_project_snapshots: ciFailureRuns, source: "recent_github_ci_snapshots", root_cause_confirmed: false } },
        measured_at: new Date().toISOString(),
        coverage: {
          listed_jobs: jobs.length,
          job_list_limit: config.mode === "github" ? 100 : null,
          job_list_may_be_limited: config.mode === "github" && jobs.length >= 100,
          retained_prompt_drafts: drafts.length,
          connected_projects: connectedProjects,
          prompt_draft_retention_per_project: 50,
          project_ci_snapshot_failures: ciFailureRuns,
          error_incident_coverage: errorMetrics ? connectedProjects : 0,
        },
      };
    })();
    metricPending = pending;
    try {
      const value = await pending;
      metricCache = { value, expires_at: Date.now() + 15_000 };
      return { ...value, cache_source: "live" };
    } finally {
      metricPending = null;
    }
  }
  return async (request) => {
    try {
      const url = new URL(request.url);
      const pathname = url.pathname;
      if (request.method === "GET" && pathname === "/healthz") {
        return json(200, {
          ok: true,
          control_plane: config.mode,
          auth_mode: config.authMode,
          runner_inbound_port: false,
          runner_status: "not_observed",
          runner_configured: Boolean(config.runner?.codexExecutable),
        });
      }
      if (request.method === "GET" && pathname === "/auth/github/start") {
        if (typeof auth.start !== "function") return json(501, { error: "GitHub OAuth is not configured" });
        const result = await auth.start({ returnTo: url.searchParams.get("returnTo") ?? "/" });
        return redirect(result.location, { "Set-Cookie": result.cookie });
      }
      if (request.method === "GET" && pathname === "/auth/github/callback") {
        if (typeof auth.callback !== "function") return json(501, { error: "GitHub OAuth is not configured" });
        try {
          const result = await auth.callback({ code: url.searchParams.get("code"), state: url.searchParams.get("state"), cookies: parseCookies(request.headers.get("cookie") ?? "") });
          return redirect(safeLocalRedirectPath(result.redirectTo, url.origin), { "Set-Cookie": result.cookie });
        } catch {
          return redirect("/?auth_error=oauth_failed");
        }
      }

      if (!pathname.startsWith("/api/")) return null;
      if (enforceSameOrigin && !["GET", "HEAD", "OPTIONS"].includes(request.method)) {
        const origin = request.headers.get("origin");
        if (!origin || origin !== url.origin) return json(403, { error: "same_origin_required" });
      }
      const session = await auth.getSession(request);
      if (!session) return json(401, { error: "authentication_required" });
      await beforeProtectedApi?.(request, session);
      if (request.method === "GET" && pathname === "/api/me") return json(200, { user: session.user, local: session.local === true });
      if (request.method === "POST" && pathname === "/api/logout") {
        const cookie = typeof auth.logout === "function" ? await auth.logout(request) : undefined;
        return json(200, { ok: true }, cookie ? { "Set-Cookie": cookie } : {});
      }
      if (pathname === "/api/projects") {
        if (!projectService) return json(501, { error: "project_management_not_configured" });
        if (request.method === "GET") return json(200, { projects: await projectService.list() });
        if (request.method === "POST") return json(201, { project: await projectService.connect((await bodyJson(request, 10_000)).repository, session.user.login) });
      }
      const incidentMatch = /^\/api\/projects\/([^/]+)\/incidents(?:\/([^/]+)\/(hypotheses|confirm))?$/.exec(pathname);
      if (incidentMatch) {
        if (!errorLearning) return json(501, { error: "error_learning_not_configured" });
        const projectId = decodeURIComponent(incidentMatch[1]);
        const incidentId = incidentMatch[2] ? decodeURIComponent(incidentMatch[2]) : null;
        const action = incidentMatch[3] ?? null;
        if (!incidentId && request.method === "GET") return json(200, { incidents: await errorLearning.list(projectId) });
        if (!incidentId && request.method === "POST") return json(201, { incident: await errorLearning.report(projectId, await bodyJson(request, 10_000), session.user.login) });
        if (incidentId && action === "hypotheses" && request.method === "POST") return json(201, { incident: await errorLearning.addHypothesis(projectId, incidentId, await bodyJson(request, 10_000), session.user.login) });
        if (incidentId && action === "confirm" && request.method === "POST") return json(200, { incident: await errorLearning.confirmCause(projectId, incidentId, await bodyJson(request, 10_000), session.user.login) });
        return json(405, { error: "method_not_allowed" });
      }
      const strategyMatch = /^\/api\/projects\/([^/]+)\/strategies(?:\/([^/]+)\/(adopt))?$/.exec(pathname);
      if (strategyMatch) {
        if (!strategyLearning) return json(501, { error: "strategy_learning_not_configured" });
        const projectId = decodeURIComponent(strategyMatch[1]);
        const strategyId = strategyMatch[2] ?? null;
        const action = strategyMatch[3] ?? null;
        if (!strategyId && request.method === "GET") return json(200, { strategies: await strategyLearning.list(projectId) });
        if (!strategyId && request.method === "POST") return json(201, { strategy: await strategyLearning.evaluate(projectId, await bodyJson(request, 10_000), session.user.login) });
        if (strategyId && action === "adopt" && request.method === "POST") {
          if (session.provider !== "github" || session.local === true) return json(403, { error: "critical_strategy_adoption_requires_github_authentication" });
          const payload = await bodyJson(request, 10_000);
          const strategy = await strategyLearning.adopt(projectId, strategyId, { confirmation: payload.confirmation, actor: session.user.login, authenticatedGithub: true });
          return json(200, { strategy });
        }
        return json(405, { error: "method_not_allowed" });
      }
      const projectMatch = /^\/api\/projects\/([^/]+)(?:\/(remove|reconnect|data))?$/.exec(pathname);
      if (projectMatch) {
        if (!projectService) return json(501, { error: "project_management_not_configured" });
        const projectId = decodeURIComponent(projectMatch[1]);
        const action = projectMatch[2] ?? "get";
        if (request.method === "GET" && action === "get") {
          const project = await projectService.get(projectId);
          return project ? json(200, { project }) : json(404, { error: "project_not_found" });
        }
        if (request.method === "POST" && action === "remove") {
          const payload = await bodyJson(request, 10_000);
          const result = await projectService.remove(projectId, { confirmation: payload.confirmation, actor: session.user.login });
          return json(result.removed ? 200 : 409, result);
        }
        if (request.method === "POST" && action === "reconnect") return json(200, { project: await projectService.connect(projectId, session.user.login) });
        if (request.method === "DELETE" && action === "data") {
          const payload = await bodyJson(request, 10_000);
          return json(200, await projectService.deleteProjectData(projectId, { confirmation: payload.confirmation, actor: session.user.login }));
        }
      }
      if (request.method === "GET" && pathname === "/api/jobs") {
        const jobs = await controlPlane.listJobs();
        const project = url.searchParams.get("project");
        return json(200, { jobs: project ? jobs.filter((job) => job.project.toLowerCase() === project.toLowerCase()) : jobs });
      }
      if (request.method === "GET" && pathname === "/api/metrics") {
        return json(200, await loadMetricSnapshot());
      }
      if (request.method === "POST" && pathname === "/api/jobs") {
        if (projectService && promptDesigner) return json(403, { error: "use_prompt_designer_and_approve_a_prompt_version" });
        const payload = await bodyJson(request);
        if (projectService) {
          const project = await projectService.get(payload.project);
          if (!project || project.status !== "connected") return json(400, { error: "project_not_connected" });
        }
        const input = validateJobInput(payload, { allowedProjects: projectService ? [] : config.runner.allowedProjects });
        const job = await controlPlane.createJob(input);
        return json(201, { job: publicJob(job) });
      }
      const jobId = jobIdFromPath(pathname);
      if (jobId && request.method === "GET" && pathname === `/api/jobs/${encodeURIComponent(jobId)}`) {
        const job = await controlPlane.getJob(jobId);
        return job ? json(200, { job }) : json(404, { error: "job_not_found" });
      }
      if (jobId && request.method === "POST" && pathname === `/api/jobs/${encodeURIComponent(jobId)}/approve`) {
        const payload = await bodyJson(request, 10_000);
        return json(200, { job: await controlPlane.approveJob(jobId, session.user.login, payload.decision) });
      }
      if (projectService && promptDesigner && /^\/api\/designer(?:\/|$)/.test(pathname)) {
        const response = await handleDesigner({ request, url, pathname, promptDesigner, actor: session.user.login });
        if (response) return response;
      }
      if (projectService && promptLibrary && request.method === "GET" && pathname === "/api/prompt-library/reviews") {
        const collection = await projectService.getLibraryReviews();
        return json(200, { reviews: collection.entries });
      }
      const reviewMatch = /^\/api\/prompt-library\/([a-z0-9][a-z0-9-]{1,100})\/review$/.exec(pathname);
      if (reviewMatch && projectService && promptLibrary && request.method === "PUT") {
        const entryId = reviewMatch[1];
        if (!promptLibrary.get(entryId)) return json(404, { error: "prompt_library_entry_not_found" });
        return json(200, { review: await projectService.saveLibraryReview(entryId, await bodyJson(request, 10_000), session.user.login) });
      }
      if (promptLibrary && request.method === "GET" && pathname === "/api/prompt-library") {
        const query = url.searchParams.get("q") ?? "";
        const category = url.searchParams.get("category") ?? "";
        return json(200, { entries: promptLibrary.search(query, { category }) });
      }
      return json(404, { error: "not_found" });
    } catch (error) {
      logger.error?.({ event: "request_failed", error_class: error?.name ?? "Error" });
      const safe = safeError(error);
      return json(safe.status, { error: safe.message });
    }
  };
}
