import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { onRequest } from "../functions/[[path]].js";

const routes = JSON.parse(await readFile(new URL("../src/pwa/_routes.json", import.meta.url), "utf8"));
const pagesConfig = await readFile(new URL("../wrangler.toml", import.meta.url), "utf8");
const workerConfig = await readFile(new URL("../wrangler.worker.toml", import.meta.url), "utf8");
const headersConfig = await readFile(new URL("../src/pwa/_headers", import.meta.url), "utf8");
const pwaHtml = await readFile(new URL("../src/pwa/index.html", import.meta.url), "utf8");

test("Wrangler configuration targets Pages and preserves the previous Worker profile", () => {
  assert.match(pagesConfig, /^pages_build_output_dir = "\.\/src\/pwa"$/m);
  assert.match(pagesConfig, /^send_metrics = false$/m);
  assert.doesNotMatch(pagesConfig, /GITHUB_TOKEN|GITHUB_CLIENT_SECRET|SESSION_SECRET|namespace-id/i);
  assert.match(workerConfig, /^main = "src\/cloudflare\/worker\.mjs"$/m);
  assert.match(workerConfig, /^\[assets\]$/m);
});

test("Pages Functions are invoked only for API, auth and health routes", () => {
  assert.deepEqual(routes, {
    version: 1,
    include: ["/api/*", "/auth/*", "/healthz"],
    exclude: [],
  });
  assert.equal(routes.include.includes("/*"), false);
});

test("Pages API fails closed without Cloudflare production bindings", async () => {
  const response = await onRequest({
    request: new Request("https://prompthub-studio.pages.dev/api/bootstrap"),
    env: {},
  });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "cloud_control_plane_not_configured" });
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("Pages health endpoint reports missing setup instead of fake availability", async () => {
  const response = await onRequest({
    request: new Request("https://prompthub-studio.pages.dev/healthz"),
    env: {},
  });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "cloud_control_plane_not_configured" });
});

test("PWA service worker caches the second application script for offline launch", async () => {
  const worker = await readFile(new URL("../src/pwa/sw.js", import.meta.url), "utf8");
  assert.match(worker, /"regression-test-request\.js"/);
  assert.match(worker, /"service-worker-client\.mjs"/);
  assert.match(headersConfig, /^\/service-worker-client\.mjs\r?\n\s+Cache-Control: no-cache$/m);
  assert.match(pwaHtml, /id="update-app"[^>]*hidden/);
  assert.match(pwaHtml, /<script type="module" src="\.\/app\.js"><\/script>/);
});

test("PWA assets and install scope resolve under the GitHub Pages repository path", async () => {
  const base = new URL("https://bndkxbqf2g-stack.github.io/prompthub-studio/src/pwa/");
  const manifest = JSON.parse(await readFile(new URL("../src/pwa/manifest.webmanifest", import.meta.url), "utf8"));
  const serviceWorkerClient = await readFile(new URL("../src/pwa/service-worker-client.mjs", import.meta.url), "utf8");

  assert.equal(new URL(manifest.start_url, base).href, base.href);
  assert.equal(new URL(manifest.scope, base).href, base.href);
  assert.equal(new URL(manifest.icons[0].src, base).href, new URL("app-icon-source.png", base).href);
  assert.match(pwaHtml, /href="\.\/styles\.css"/);
  assert.match(pwaHtml, /src="\.\/app\.js"/);
  assert.match(serviceWorkerClient, /new URL\("\.\/sw\.js", locationObject\.href\)/);
});

test("service worker preserves unrelated caches and waits for a user-requested update", async () => {
  const source = await readFile(new URL("../src/pwa/sw.js", import.meta.url), "utf8");
  const listeners = new Map();
  const calls = { added: [], deleted: [], claimed: 0, skipped: 0, matched: 0 };
  const caches = {
    async open(name) {
      calls.opened = name;
      return { async addAll(paths) { calls.added = paths; } };
    },
    async keys() { return ["prompthub-static-v3", "prompthub-static-v4", "other-app-cache", "prompthub-static-v7"]; },
    async delete(name) { calls.deleted.push(name); },
    async match() { calls.matched += 1; return new Response("cached offline asset"); },
  };
  const self = {
    location: { origin: "https://prompthub.example", href: "https://prompthub.example/src/pwa/sw.js" },
    clients: { async claim() { calls.claimed += 1; } },
    async skipWaiting() { calls.skipped += 1; },
    addEventListener(type, listener) { listeners.set(type, listener); },
  };
  runInNewContext(source, { self, caches, URL, fetch: async () => { throw new Error("offline"); } });

  const waits = [];
  listeners.get("install")({ waitUntil(promise) { waits.push(promise); } });
  await Promise.all(waits);
  assert.equal(calls.opened, "prompthub-static-v7");
  assert.ok(calls.added.includes("https://prompthub.example/src/pwa/strategy-presentation.mjs"));
  assert.ok(calls.added.includes("https://prompthub.example/src/pwa/quota-presentation.mjs"));
  assert.ok(calls.added.includes("https://prompthub.example/src/pwa/service-worker-client.mjs"));

  listeners.get("activate")({ waitUntil(promise) { waits.push(promise); } });
  await Promise.all(waits);
  assert.deepEqual(calls.deleted, ["prompthub-static-v3", "prompthub-static-v4"]);
  assert.equal(calls.claimed, 1);

  listeners.get("message")({ data: { type: "UNRELATED_MESSAGE" }, waitUntil() { assert.fail("unrelated messages must not activate the worker"); } });
  assert.equal(calls.skipped, 0);
  listeners.get("message")({ data: { type: "PROMPTHUB_ACTIVATE_UPDATE" }, waitUntil(promise) { waits.push(promise); } });
  await Promise.all(waits);
  assert.equal(calls.skipped, 1);

  let responsePromise;
  listeners.get("fetch")({ request: new Request("https://prompthub.example/src/pwa/styles.css"), respondWith(promise) { responsePromise = promise; } });
  assert.equal(await (await responsePromise).text(), "cached offline asset");
  assert.equal(calls.matched, 1);
  const excludedRequests = [
    new Request("https://prompthub.example/api/me"),
    new Request("https://prompthub.example/auth/github/start"),
    new Request("https://prompthub.example/healthz"),
    new Request("https://prompthub.example/action", { method: "POST", body: "action" }),
    new Request("https://other.example/styles.css"),
  ];
  for (const request of excludedRequests) {
    let intercepted = false;
    listeners.get("fetch")({ request, respondWith() { intercepted = true; } });
    assert.equal(intercepted, false, `${request.method} ${request.url} must bypass the service worker`);
  }
  assert.equal(calls.matched, 1);
});

