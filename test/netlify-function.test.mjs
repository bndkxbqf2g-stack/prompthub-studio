import test from "node:test";
import assert from "node:assert/strict";
import handle, { config, createNetlifyFunction } from "../netlify/functions/prompthub.mjs";

function validEnvironment(overrides = {}) {
  return {
    CONTEXT: "production",
    NODE_ENV: "development",
    PROMPTHUB_MODE: "github",
    AUTH_MODE: "github",
    PROMPTHUB_PUBLIC_ORIGIN: "https://prompthub.example",
    SESSION_SECRET: "a-test-production-secret-with-more-than-32-characters",
    GITHUB_TOKEN: "server-only-control-token",
    GITHUB_REPOSITORY: "owner/private-control",
    GITHUB_CLIENT_ID: "oauth-client-id",
    GITHUB_CLIENT_SECRET: "oauth-client-secret",
    GITHUB_ALLOWED_LOGINS: "allowed-user",
    ...overrides,
  };
}

function fakeStore() {
  return {
    async get() { return null; },
    async getWithMetadata() { return null; },
    async setJSON() { return { modified: true, etag: '"test"' }; },
    async delete() {},
  };
}

test("Netlify previews never construct the production app or open production Blobs", async () => {
  let storesOpened = 0;
  let appsBuilt = 0;
  const fn = createNetlifyFunction({
    env: validEnvironment({ CONTEXT: "deploy-preview" }),
    getStore() { storesOpened += 1; throw new Error("must not be called"); },
    applicationFactory() { appsBuilt += 1; throw new Error("must not be called"); },
  });

  const response = await fn(new Request("https://preview.example/api/me"));
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error, "production_api_disabled");
  assert.deepEqual({ storesOpened, appsBuilt }, { storesOpened: 0, appsBuilt: 0 });
});

test("Netlify function checks the configured public origin before accessing provider state", async () => {
  let storesOpened = 0;
  const fn = createNetlifyFunction({
    env: validEnvironment(),
    getStore() { storesOpened += 1; return fakeStore(); },
  });

  const response = await fn(new Request("https://other.example/api/me"));
  assert.equal(response.status, 421);
  assert.equal(storesOpened, 0);
});

test("production function shares the app, uses strongly consistent server-side stores, and leaves jobs closed", async () => {
  let storesOpened = 0;
  let appsBuilt = 0;
  let receivedOptions;
  const fn = createNetlifyFunction({
    env: validEnvironment(),
    getStore(options) {
      storesOpened += 1;
      assert.deepEqual(options, { name: "prompthub-auth-v1", consistency: "strong" });
      return fakeStore();
    },
    async applicationFactory(options) {
      appsBuilt += 1;
      receivedOptions = options;
      return { handler: async () => new Response("ready", { status: 200 }) };
    },
  });

  const first = await fn(new Request("https://prompthub.example/api/me"));
  const second = await fn(new Request("https://prompthub.example/healthz"));
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(await first.text(), "ready");
  assert.equal(appsBuilt, 1);
  assert.equal(storesOpened, 1);
  assert.equal(receivedOptions.env.NODE_ENV, "production");
  assert.equal(receivedOptions.enforceSameOrigin, true);
  assert.equal((await receivedOptions.jobAdmissionGate.status()).status, "unknown");
  assert.equal((await receivedOptions.jobAdmissionGate.status()).allowed, false);
  assert.deepEqual(config.path, ["/api/*", "/auth/*", "/healthz"]);
  assert.equal(typeof handle, "function");
});

test("production misconfiguration returns a generic unavailable response without exposing secrets", async () => {
  const fn = createNetlifyFunction({ env: validEnvironment({ GITHUB_CLIENT_SECRET: "" }), getStore() { throw new Error("must not be called"); } });
  const response = await fn(new Request("https://prompthub.example/api/me"));
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /oauth-client|secret|private-control/);
});
