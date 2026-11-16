import process from "node:process";

const MAX_ACTIVE_JOBS = 2;
const DEFAULT_ALLOWED_PROJECTS = ["demo"];

function intValue(env, name, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return value;
}

function listValue(raw, fallback = []) {
  if (!raw) return fallback;
  return raw.split(",").map((item) => item.trim()).filter(Boolean);
}

function jsonArrayValue(raw, name, fallback) {
  if (!raw) return fallback;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`${name} must be valid JSON`);
  }
  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) {
    throw new Error(`${name} must be a JSON array of strings`);
  }
  return parsed;
}

function jsonObjectValue(raw, name, fallback) {
  if (!raw) return fallback;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`${name} must be valid JSON`);
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${name} must be a JSON object`);
  }
  return parsed;
}

function jsonCommandListValue(raw, name, fallback) {
  if (!raw) return fallback;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`${name} must be valid JSON`);
  }
  if (!Array.isArray(parsed) || parsed.some((command) => !Array.isArray(command) || command.length === 0 || command.some((item) => typeof item !== "string"))) {
    throw new Error(`${name} must be a JSON array of string arrays`);
  }
  return parsed;
}

export function readConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV ?? "development";
  const mode = env.PROMPTHUB_MODE ?? "memory";
  const authMode = env.AUTH_MODE ?? (mode === "github" ? "github" : "local");
  const host = env.PROMPTHUB_HOST ?? "127.0.0.1";
  const port = intValue(env, "PROMPTHUB_PORT", 8787, { min: 1, max: 65535 });
  const projectRoot = env.PROMPTHUB_PROJECT_ROOT || process.cwd();
  const allowedProjects = listValue(env.PROMPTHUB_ALLOWED_PROJECTS, DEFAULT_ALLOWED_PROJECTS);
  const projectPaths = jsonObjectValue(env.PROMPTHUB_PROJECT_PATHS_JSON, "PROMPTHUB_PROJECT_PATHS_JSON", {});
  const codexArgs = jsonArrayValue(env.CODEX_ARGS_JSON, "CODEX_ARGS_JSON", ["exec", "--json", "--", "$PROMPTHUB_PROMPT"]);
  const npmExecutable = env.PROMPTHUB_NPM_EXECUTABLE ?? (process.platform === "win32" ? "npm.cmd" : "npm");
  const requiredCommands = jsonCommandListValue(env.PROMPTHUB_REQUIRED_CHECKS_JSON, "PROMPTHUB_REQUIRED_CHECKS_JSON", [[npmExecutable, "test"], [npmExecutable, "run", "check"]]);
  const sessionSecret = env.SESSION_SECRET ?? "development-only-session-secret-change-me";
  const publicOrigin = env.PROMPTHUB_PUBLIC_ORIGIN ?? `http://${host}:${port}`;

  if (!new Set(["memory", "github"]).has(mode)) {
    throw new Error("PROMPTHUB_MODE must be memory or github");
  }
  if (!new Set(["local", "github"]).has(authMode)) {
    throw new Error("AUTH_MODE must be local or github");
  }
  if (nodeEnv === "production" && authMode === "local") {
    throw new Error("AUTH_MODE=local is forbidden in production");
  }
  if (nodeEnv === "production" && sessionSecret.length < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 characters in production");
  }
  if (nodeEnv === "production") {
    let parsedOrigin;
    try {
      parsedOrigin = new URL(publicOrigin);
    } catch {
      throw new Error("PROMPTHUB_PUBLIC_ORIGIN must be a valid HTTPS origin in production");
    }
    if (parsedOrigin.protocol !== "https:" || parsedOrigin.pathname !== "/" || parsedOrigin.search || parsedOrigin.hash || parsedOrigin.username || parsedOrigin.password) {
      throw new Error("PROMPTHUB_PUBLIC_ORIGIN must be an HTTPS origin without a path in production");
    }
  }
  if (nodeEnv === "production" && authMode === "github" && listValue(env.GITHUB_ALLOWED_LOGINS).length === 0) {
    throw new Error("GITHUB_ALLOWED_LOGINS must contain at least one login in production");
  }
  if (mode === "github" && (!env.GITHUB_TOKEN || !env.GITHUB_REPOSITORY)) {
    throw new Error("GITHUB_TOKEN and GITHUB_REPOSITORY are required in github mode");
  }
  if (authMode === "github" && (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET)) {
    throw new Error("GitHub OAuth credentials are required when AUTH_MODE=github");
  }
  if (mode === "github" && env.GITHUB_REPOSITORY.split("/").length !== 2) {
    throw new Error("GITHUB_REPOSITORY must use owner/name form");
  }
  if (codexArgs.length > 0 && !codexArgs.some((arg) => arg.includes("$PROMPTHUB_PROMPT"))) {
    throw new Error("CODEX_ARGS_JSON must contain the $PROMPTHUB_PROMPT placeholder");
  }

  return Object.freeze({
    nodeEnv,
    mode,
    authMode,
    host,
    port,
    publicOrigin: nodeEnv === "production" ? new URL(publicOrigin).origin : publicOrigin,
    sessionSecret,
    github: Object.freeze({
      apiUrl: env.GITHUB_API_URL ?? "https://api.github.com",
      token: env.GITHUB_TOKEN ?? "",
      repository: env.GITHUB_REPOSITORY ?? "",
      branch: env.GITHUB_BRANCH ?? "main",
      requirePrivate: env.GITHUB_REQUIRE_PRIVATE !== "false",
      allowedLogins: listValue(env.GITHUB_ALLOWED_LOGINS),
      clientId: env.GITHUB_CLIENT_ID ?? "",
      clientSecret: env.GITHUB_CLIENT_SECRET ?? "",
      oauthScopes: listValue(env.GITHUB_OAUTH_SCOPES, ["read:user"]),
    }),
    runner: Object.freeze({
      id: env.PROMPTHUB_RUNNER_ID ?? "mac-runner-local",
      projectRoot,
      allowedProjects: Object.freeze(allowedProjects),
      projectPaths: Object.freeze(projectPaths),
      leasePath: env.PROMPTHUB_LEASE_PATH ?? ".prompthub/active-jobs.json",
      leaseTtlMs: intValue(env, "PROMPTHUB_LEASE_TTL_MS", 120000, { min: 1000, max: 86400000 }),
      heartbeatMs: intValue(env, "PROMPTHUB_HEARTBEAT_MS", 30000, { min: 1000, max: 3600000 }),
      pollMs: intValue(env, "PROMPTHUB_POLL_MS", 10000, { min: 1000, max: 3600000 }),
      codexExecutable: env.CODEX_EXECUTABLE ?? "",
      codexArgs: Object.freeze(codexArgs),
      requiredCommands: Object.freeze(requiredCommands.map((command) => Object.freeze(command.slice()))),
      maxActiveJobs: MAX_ACTIVE_JOBS,
    }),
  });
}

export { MAX_ACTIVE_JOBS };
