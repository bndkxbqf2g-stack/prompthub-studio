import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { onRequest } from "../functions/[[path]].js";

const routes = JSON.parse(await readFile(new URL("../src/pwa/_routes.json", import.meta.url), "utf8"));
const pagesConfig = await readFile(new URL("../wrangler.toml", import.meta.url), "utf8");
const workerConfig = await readFile(new URL("../wrangler.worker.toml", import.meta.url), "utf8");

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
  assert.match(worker, /"\/regression-test-request\.js"/);
});

