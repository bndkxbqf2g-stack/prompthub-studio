import promptLibraryData from "../../knowledge/prompt-library.json" with { type: "json" };
import { GitHubOAuth } from "../auth/github-oauth.mjs";
import { createRequestHandler } from "../api/handler.mjs";
import { createControlPlane, createGitHubClient } from "../control/index.mjs";
import { PromptDesigner } from "../designer/prompt-designer.mjs";
import { ErrorLearningEngine } from "../knowledge/error-learning.mjs";
import { ProjectService } from "../projects/project-service.mjs";
import { GitHubProjectStore } from "../projects/project-store.mjs";
import { PromptLibrary } from "../research/prompt-library.mjs";
import { CloudflareKVSessionStore } from "./kv-session-store.mjs";

const runtimes = new WeakMap();
const REQUIRED_BINDINGS = ["GITHUB_TOKEN", "GITHUB_REPOSITORY", "GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET", "SESSION_SECRET", "GITHUB_ALLOWED_LOGINS"];
const SECURITY_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; manifest-src 'self'; worker-src 'self'",
};

async function assertPrivateControlRepository(controlPlane) {
  try {
    const repository = await controlPlane.assertRepositorySafety();
    if (repository.private !== true) throw new Error("configured GitHub control repository must be private");
    return repository;
  } catch (error) {
    if (error?.message === "configured GitHub control repository must be private") {
      throw Object.assign(new Error("control_repository_not_private"), { statusCode: 503 });
    }
    throw error;
  }
}

function failure(status, error) {
  return new Response(JSON.stringify({ error }), { status, headers: SECURITY_HEADERS });
}

function requiredMissing(env) {
  return REQUIRED_BINDINGS.filter((name) => typeof env[name] !== "string" || env[name].trim() === "");
}

function createRuntime(env, origin) {
  if (env.SESSION_SECRET.length < 32) throw Object.assign(new Error("cloud_configuration_invalid"), { statusCode: 503 });
  const allowedLogins = env.GITHUB_ALLOWED_LOGINS.split(",").map((login) => login.trim()).filter(Boolean);
  if (allowedLogins.length === 0 || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(env.GITHUB_REPOSITORY)) {
    throw Object.assign(new Error("cloud_configuration_invalid"), { statusCode: 503 });
  }
  if (!env.SESSIONS) throw Object.assign(new Error("free_serverless_storage_unavailable"), { statusCode: 503 });

  const config = {
    mode: "github",
    authMode: "github",
    nodeEnv: "production",
    publicOrigin: origin,
    github: {
      token: env.GITHUB_TOKEN,
      repository: env.GITHUB_REPOSITORY,
      branch: env.GITHUB_BRANCH || "main",
      apiUrl: env.GITHUB_API_URL || "https://api.github.com",
      requirePrivate: true,
      allowedLogins,
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
      oauthScopes: (env.GITHUB_OAUTH_SCOPES || "read:user").split(",").map((scope) => scope.trim()).filter(Boolean),
    },
    runner: {
      id: "cloud-runner-not-configured",
      allowedProjects: [],
      projectPaths: {},
      leasePath: ".prompthub/active-jobs.json",
      leaseTtlMs: 120_000,
      maxActiveJobs: 2,
      codexExecutable: "",
    },
  };
  const fetchImpl = env.GITHUB_FETCH_IMPL ?? globalThis.fetch;
  const githubClient = createGitHubClient(config, { fetchImpl });
  const controlPlane = createControlPlane(config, { fetchImpl, githubClient });
  const projectService = new ProjectService({
    store: new GitHubProjectStore({ client: githubClient, controlRepository: config.github.repository, branch: config.github.branch }),
    client: githubClient,
    controlPlane,
    controlRepository: config.github.repository,
  });
  const promptLibrary = new PromptLibrary({ entries: promptLibraryData.entries });
  const errorLearning = new ErrorLearningEngine({ projectService });
  const promptDesigner = new PromptDesigner({ projectService, controlPlane, promptLibrary, errorLearning });
  const sessions = new CloudflareKVSessionStore({ namespace: env.SESSIONS });
  const auth = new GitHubOAuth({
    clientId: config.github.clientId,
    clientSecret: config.github.clientSecret,
    scopes: config.github.oauthScopes,
    publicOrigin: origin,
    sessionSecret: env.SESSION_SECRET,
    allowedLogins,
    production: true,
    fetchImpl,
    store: sessions,
    stateStore: sessions,
  });
  const handler = createRequestHandler({
    config,
    controlPlane,
    auth,
    projectService,
    promptDesigner,
    promptLibrary,
    errorLearning,
    enforceSameOrigin: true,
    beforeProtectedApi: async () => assertPrivateControlRepository(controlPlane),
  });
  return { handler, controlPlane };
}

function getRuntime(env, origin) {
  let byOrigin = runtimes.get(env);
  if (!byOrigin) {
    byOrigin = new Map();
    runtimes.set(env, byOrigin);
  }
  if (!byOrigin.has(origin)) byOrigin.set(origin, createRuntime(env, origin));
  return byOrigin.get(origin);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/") && !url.pathname.startsWith("/auth/") && url.pathname !== "/healthz") {
      if (!env.ASSETS) return failure(503, "static_assets_not_configured");
      return env.ASSETS.fetch(request);
    }
    if (url.pathname === "/healthz" && request.method === "GET") {
      const missing = requiredMissing(env);
      if (missing.length) return failure(503, "cloud_control_plane_not_configured");
      try {
        const runtime = getRuntime(env, url.origin);
        await assertPrivateControlRepository(runtime.controlPlane);
        return new Response(JSON.stringify({ ok: true, control_plane: "github", auth_mode: "github", runner_inbound_port: false, runner_status: "not_configured" }), { headers: SECURITY_HEADERS });
      } catch (error) {
        if (error?.statusCode === 503 && error.message === "control_repository_not_private") return failure(503, "control_repository_not_private");
        return failure(503, "cloud_control_plane_unavailable");
      }
    }
    const missing = requiredMissing(env);
    if (missing.length) return failure(503, "cloud_control_plane_not_configured");
    try {
      const runtime = getRuntime(env, url.origin);
      const response = await runtime.handler(request);
      return response ?? failure(404, "not_found");
    } catch (error) {
      const status = error?.statusCode === 503 ? 503 : 502;
      return failure(status, status === 503 ? "free_serverless_storage_unavailable" : "github_control_plane_unavailable");
    }
  },
};
