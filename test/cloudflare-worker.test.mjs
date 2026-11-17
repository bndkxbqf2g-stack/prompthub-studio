import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/cloudflare/worker.mjs";
import { hmacBase64Url } from "../src/security/web-crypto.mjs";
import { CloudflareD1SessionStore } from "../src/cloudflare/d1-session-store.mjs";
import { MemoryD1Database } from "./helpers/memory-d1.mjs";

function configuredEnv({ fetchImpl = async () => new Response(JSON.stringify({ private: true }), { status: 200 }) } = {}) {
  return {
    GITHUB_TOKEN: "server-secret-token",
    GITHUB_REPOSITORY: "owner/control",
    GITHUB_CLIENT_ID: "oauth-client",
    GITHUB_CLIENT_SECRET: "oauth-secret",
    SESSION_SECRET: "0123456789abcdef0123456789abcdef",
    GITHUB_ALLOWED_LOGINS: "allowed-user",
    AUTH_DB: new MemoryD1Database(),
    GITHUB_FETCH_IMPL: fetchImpl,
    ASSETS: { async fetch() { return new Response("PWA asset", { status: 200 }); } },
  };
}

async function sessionCookie(env) {
  const sessions = new CloudflareD1SessionStore({ database: env.AUTH_DB, sessionSecret: env.SESSION_SECRET });
  const id = await sessions.create({ user: { login: "allowed-user", id: 7 }, token: "private-user-token", provider: "github" });
  return `prompthub_session=${id}.${await hmacBase64Url(id, env.SESSION_SECRET)}`;
}

test("Cloudflare Worker serves static assets without requiring API secrets", async () => {
  const response = await worker.fetch(new Request("https://prompthub.example/"), {
    ASSETS: { async fetch() { return new Response("PWA static asset", { status: 200 }); } },
  });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "PWA static asset");
});

test("Cloudflare health reports missing runtime configuration instead of false availability", async () => {
  const response = await worker.fetch(new Request("https://prompthub.example/healthz"), {});
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "cloud_control_plane_not_configured" });
});

test("Cloudflare API validates same-origin and control-repository privacy before protected operations", async () => {
  const requested = [];
  const env = configuredEnv({ fetchImpl: async (url) => {
    requested.push(String(url));
    return new Response(JSON.stringify({ private: true }), { status: 200 });
  } });
  const cookie = await sessionCookie(env);
  const denied = await worker.fetch(new Request("https://prompthub.example/api/jobs", {
    method: "POST", headers: { cookie, origin: "https://attacker.example", "content-type": "application/json" }, body: JSON.stringify({ prompt: "job", project: "owner/repo" }),
  }), env);
  assert.equal(denied.status, 403);
  assert.deepEqual(requested, []);

  const directJob = await worker.fetch(new Request("https://prompthub.example/api/jobs", {
    method: "POST", headers: { cookie, origin: "https://prompthub.example", "content-type": "application/json" }, body: JSON.stringify({ prompt: "job", project: "owner/repo" }),
  }), env);
  assert.equal(directJob.status, 403);
  assert.equal(requested.length, 1);
  assert.match(requested[0], /repos\/owner\/control$/);
});

test("Cloudflare Worker fails closed when the control repository is public", async () => {
  const env = configuredEnv({ fetchImpl: async () => new Response(JSON.stringify({ private: false }), { status: 200 }) });
  const response = await worker.fetch(new Request("https://prompthub.example/healthz"), env);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "control_repository_not_private" });
});

test("D1 quota errors fail closed with a retryable service-unavailable status", async () => {
  const database = new MemoryD1Database();
  database.failNext = true;
  const store = new CloudflareD1SessionStore({ database, sessionSecret: "0123456789abcdef0123456789abcdef" });
  await assert.rejects(store.create({ user: { login: "alice", id: 1 }, token: "secret" }), (error) => error.statusCode === 503 && error.message === "free_serverless_storage_unavailable");
});

test("Cloudflare Worker does not accept the legacy KV binding as auth storage", async () => {
  const env = configuredEnv();
  delete env.AUTH_DB;
  env.SESSIONS = { async get() { return null; } };
  const response = await worker.fetch(new Request("https://prompthub.example/api/me"), env);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "cloud_control_plane_not_configured" });
});
