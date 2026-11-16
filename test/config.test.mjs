import test from "node:test";
import assert from "node:assert/strict";
import { MAX_ACTIVE_JOBS, readConfig } from "../src/config.mjs";

function productionEnv(overrides = {}) {
  return {
    NODE_ENV: "production",
    PROMPTHUB_MODE: "github",
    AUTH_MODE: "github",
    PROMPTHUB_PUBLIC_ORIGIN: "https://control.example",
    SESSION_SECRET: "a-production-session-secret-that-is-long-enough",
    GITHUB_TOKEN: "configured-server-token",
    GITHUB_REPOSITORY: "owner/private-control",
    GITHUB_CLIENT_ID: "client",
    GITHUB_CLIENT_SECRET: "secret",
    GITHUB_ALLOWED_LOGINS: "allowed-user",
    CODEX_ARGS_JSON: '["exec","--","$PROMPTHUB_PROMPT"]',
    ...overrides,
  };
}

test("production configuration requires HTTPS and an explicit login allowlist", () => {
  assert.equal(readConfig(productionEnv()).runner.maxActiveJobs, MAX_ACTIVE_JOBS);
  assert.throws(() => readConfig(productionEnv({ GITHUB_ALLOWED_LOGINS: "" })), /ALLOW/);
  assert.throws(() => readConfig(productionEnv({ PROMPTHUB_PUBLIC_ORIGIN: "http://control.example" })), /HTTPS/);
});

test("Codex JSONL telemetry is enabled in the default runner arguments", () => {
  const config = readConfig({ NODE_ENV: "test", PROMPTHUB_MODE: "memory", AUTH_MODE: "local" });
  assert.deepEqual(config.runner.codexArgs, ["exec", "--json", "--", "$PROMPTHUB_PROMPT"]);
});

test("local development mode cannot silently become a production auth mode", () => {
  assert.throws(() => readConfig({ NODE_ENV: "production", PROMPTHUB_MODE: "memory", AUTH_MODE: "local", PROMPTHUB_PUBLIC_ORIGIN: "https://control.example", SESSION_SECRET: "a-production-session-secret-that-is-long-enough" }), /local/);
});
