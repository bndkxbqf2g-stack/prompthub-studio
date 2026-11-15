import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/cloudflare/worker.mjs";
import { hmacBase64Url } from "../src/security/web-crypto.mjs";
import { CloudflareKVSessionStore } from "../src/cloudflare/kv-session-store.mjs";

function memoryKv() {
  const values = new Map();
  return {
    values,
    async put(key, value) { values.set(key, value); },
    async get(key) { return values.get(key) ?? null; },
    async delete(key) { values.delete(key); },
  };
}

function configuredEnv({ fetchImpl = async () => new Response(JSON.stringify({ private: true }), { status: 200 }) } = {}) {
  return {
    GITHUB_TOKEN: "server-secret-token",
    GITHUB_REPOSITORY: "owner/control",
    GITHUB_CLIENT_ID: "oauth-client",
    GITHUB_CLIENT_SECRET: "oauth-secret",
    SESSION_SECRET: "0123456789abcdef0123456789abcdef",
    GITHUB_ALLOWED_LOGINS: "allowed-user",
    SESSIONS: memoryKv(),
    GITHUB_FETCH_IMPL: fetchImpl,
    ASSETS: { async fetch() { return new Response("PWA asset", { status: 200 }); } },
  };
}

async function sessionCookie(env) {
  const id = "test-session";
  const session = { id, user: { login: "allowed-user", id: 7 }, token: "private-user-token", provider: "github", createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString() };
  await env.SESSIONS.put(`prompthub:session:${id}`, JSON.stringify(session), { expirationTtl: 60 });
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

test("free KV quota errors fail closed with a retryable service-unavailable status", async () => {
  const store = new CloudflareKVSessionStore({ namespace: {
    async put() { throw new Error("quota exceeded"); },
    async get() { throw new Error("quota exceeded"); },
    async delete() { throw new Error("quota exceeded"); },
  } });
  await assert.rejects(store.create({ user: { login: "alice" }, token: "secret" }), (error) => error.statusCode === 503 && error.message === "free_serverless_storage_unavailable");
});
